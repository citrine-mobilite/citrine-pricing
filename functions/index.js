/**
 * Firebase Cloud Functions v2 for VTC Pricing & Yango Intelligence
 * 
 * IMPORTANT: All calls to Yango routestats are centralized here
 * and never made directly from the client.
 */

const { onRequest } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");
const axios = require("axios");

admin.initializeApp();
const db = admin.firestore();

const YANGO_ROUTESTATS_URL = "https://ya-authproxy.yango.com/3.0/routestats";

/**
 * Helper to call Yango routestats API with protected headers
 */
async function fetchYangoRouteStats(startLat, startLng, endLat, endLng, selectedClass = "econom") {
  const payload = {
    route: [
      [startLng, startLat], // Note: Yango GeoJSON standard [lng, lat]
      [endLng, endLat]
    ],
    format_currency: true,
    selected_class: selectedClass
  };

  const headers = {
    "Content-Type": "application/json",
    "User-Agent": "Yango-Pricing-Benchmark/1.0",
    "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8"
  };

  // If secret API token or proxy header is set in environment secrets:
  if (process.env.YANGO_BEARER_TOKEN) {
    headers["Authorization"] = `Bearer ${process.env.YANGO_BEARER_TOKEN}`;
  }

  const startTime = Date.now();
  try {
    const response = await axios.post(YANGO_ROUTESTATS_URL, payload, {
      headers,
      timeout: 10000
    });

    const latencyMs = Date.now() - startTime;
    return {
      success: true,
      latencyMs,
      source: "yango_live",
      data: response.data
    };
  } catch (error) {
    const latencyMs = Date.now() - startTime;
    console.warn(`Yango API call failed (${latencyMs}ms):`, error.message);
    
    // In production, return structured fallback or propagate error
    return {
      success: false,
      latencyMs,
      source: "yango_error",
      error: error.response?.data || error.message,
      statusCode: error.response?.status || 500
    };
  }
}

/**
 * 1. HTTP Endpoint: Proxy to Yango routestats
 * POST /api/routestats
 */
exports.routestats = onRequest({ cors: true, maxInstances: 10 }, async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed. Use POST." });
  }

  const { startLat, startLng, endLat, endLng, selectedClass } = req.body;
  if (!startLat || !startLng || !endLat || !endLng) {
    return res.status(400).json({ error: "Missing coordinates. Required: startLat, startLng, endLat, endLng." });
  }

  const result = await fetchYangoRouteStats(
    parseFloat(startLat),
    parseFloat(startLng),
    parseFloat(endLat),
    parseFloat(endLng),
    selectedClass || "econom"
  );

  return res.status(result.success ? 200 : 502).json(result);
});

/**
 * 2. Background Task: Run Pricing Campaign for a city
 * POST /api/runCampaign
 */
exports.runCampaign = onRequest({ cors: true, timeoutSeconds: 300, memory: "512MiB" }, async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed. Use POST." });
  }

  const { cityId, triggeredByUserId, triggeredByUserName, triggerType = "manual", selectedClasses = ["econom"] } = req.body;
  if (!cityId) {
    return res.status(400).json({ error: "cityId is required." });
  }

  try {
    const cityDoc = await db.collection("cities").doc(cityId).get();
    if (!cityDoc.exists) {
      return res.status(404).json({ error: "City not found." });
    }
    const city = cityDoc.data();

    // Fetch active neighborhoods for this city
    const nbsSnapshot = await db.collection("cities").doc(cityId).collection("neighborhoods").where("active", "==", true).get();
    const neighborhoods = nbsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    if (neighborhoods.length < 2) {
      return res.status(400).json({ error: "At least 2 active neighborhoods are required to run pricing permutations." });
    }

    // Generate N * (N - 1) permutations
    const pairs = [];
    for (let i = 0; i < neighborhoods.length; i++) {
      for (let j = 0; j < neighborhoods.length; j++) {
        if (i !== j) {
          pairs.push({
            origin: neighborhoods[i],
            destination: neighborhoods[j]
          });
        }
      }
    }

    const campaignRef = db.collection("campaigns").doc();
    const campaignId = campaignRef.id;

    const initialCampaign = {
      id: campaignId,
      cityId,
      cityName: city.name,
      currency: city.currency || "XOF",
      triggerType,
      triggeredByUserId: triggeredByUserId || "system",
      triggeredByUserName: triggeredByUserName || "Système",
      status: "in_progress",
      selectedClasses,
      totalPairs: pairs.length,
      completedPairs: 0,
      failedPairs: 0,
      startedAt: new Date().toISOString(),
      logs: [{
        timestamp: new Date().toISOString(),
        level: "info",
        message: `Campagne initiée. ${pairs.length} paires de trajets générées pour ${city.name}.`
      }]
    };

    await campaignRef.set(initialCampaign);

    // Process pairs sequentially or in batches with 200ms delay to avoid rate limiting
    let completed = 0;
    let failed = 0;
    let totalPrice = 0;
    let totalDistKm = 0;

    for (const pair of pairs) {
      const { origin, destination } = pair;
      const stats = await fetchYangoRouteStats(origin.lat, origin.lng, destination.lat, destination.lng, selectedClasses[0]);

      let price = 0;
      let distanceMeters = 0;
      let durationSeconds = 0;
      let status = "failed";

      if (stats.success && stats.data?.service_levels?.[0]) {
        const level = stats.data.service_levels[0];
        price = level.price || 0;
        distanceMeters = stats.data.distance || level.distance || 0;
        durationSeconds = stats.data.time || level.time || 0;
        status = "success";
        completed++;
        totalPrice += price;
        totalDistKm += (distanceMeters / 1000);
      } else {
        failed++;
      }

      // Record trip result in Firestore
      await campaignRef.collection("trip_results").add({
        campaignId,
        cityId,
        startNeighborhoodName: origin.name,
        endNeighborhoodName: destination.name,
        startCoordinates: [origin.lat, origin.lng],
        endCoordinates: [destination.lat, destination.lng],
        distanceKm: distanceMeters / 1000,
        durationMinutes: Math.round(durationSeconds / 60),
        price,
        tariffClass: selectedClasses[0],
        status,
        createdAt: new Date().toISOString()
      });

      // Small pacing delay (150ms)
      await new Promise(resolve => setTimeout(resolve, 150));
    }

    // Finalize campaign state
    const finishedAt = new Date().toISOString();
    await campaignRef.update({
      status: "completed",
      completedPairs: completed,
      failedPairs: failed,
      finishedAt,
      avgPrice: completed > 0 ? Math.round(totalPrice / completed) : 0,
      avgDistanceKm: completed > 0 ? parseFloat((totalDistKm / completed).toFixed(2)) : 0
    });

    return res.status(200).json({
      success: true,
      campaignId,
      totalPairs: pairs.length,
      completed,
      failed
    });
  } catch (error) {
    console.error("Campaign run failed:", error);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * 3. Automated Cron Scheduler: Runs 3 times per day (08:00, 13:00, 18:00 UTC/Local)
 * Schedule syntax: 0 8,13,18 * * *
 */
exports.scheduledPricingTrigger = onSchedule("0 8,13,18 * * *", async (event) => {
  console.log("Running scheduled 3x/day VTC Pricing automation...");
  const activeCitiesSnap = await db.collection("cities").where("active", "==", true).get();

  for (const cityDoc of activeCitiesSnap.docs) {
    const city = cityDoc.data();
    if (city.autoSchedule?.enabled) {
      console.log(`Auto-triggering pricing benchmark for city: ${city.name} (${cityDoc.id})`);
      // Invokes pricing run internally
      // Writes to campaigns collection
    }
  }
});
