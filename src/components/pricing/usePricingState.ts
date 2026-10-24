import { useState, useEffect, useMemo } from 'react';
import Swal from 'sweetalert2';
import { City, PricingCampaign, TripResult } from '../../types';
import { api } from '../../services/api';
import { findCityInList, isCampaignInCity } from '../../utils/cityMatching';

export function usePricingCampaign(
  campaigns: PricingCampaign[],
  selectedCityId: string | number,
  propSelectedCampaignId?: string | number | null,
  onSelectCampaignId?: (id: string) => void,
  onSelectCityId?: (id: string) => void,
  onRefresh?: () => void,
  cities?: City[]
) {
  const currentCity = useMemo(() => {
    return findCityInList(cities || [], selectedCityId);
  }, [cities, selectedCityId]);

  const cityCampaigns = useMemo(
    () => campaigns.filter((c) => {
      if (currentCity && isCampaignInCity(c, currentCity)) return true;
      return String(c.cityId) === String(selectedCityId) || c.cityId === selectedCityId;
    }),
    [campaigns, selectedCityId, currentCity]
  );

  const [internalCampaignId, setInternalCampaignId] = useState<string>(() => {
    if (propSelectedCampaignId) {
      const match = campaigns.find((c) => String(c.id) === String(propSelectedCampaignId) || c.uuid === String(propSelectedCampaignId));
      if (match) return match.uuid || String(match.id);
    }
    const firstCity = cityCampaigns[0];
    if (firstCity) return firstCity.uuid || String(firstCity.id);
    const firstOverall = campaigns[0];
    return firstOverall ? (firstOverall.uuid || String(firstOverall.id)) : '';
  });

  useEffect(() => {
    if (propSelectedCampaignId) {
      const match = campaigns.find((c) => String(c.id) === String(propSelectedCampaignId) || c.uuid === String(propSelectedCampaignId));
      if (match) {
        setInternalCampaignId(match.uuid || String(match.id));
      }
    } else if (!internalCampaignId && cityCampaigns.length > 0) {
      setInternalCampaignId(cityCampaigns[0].uuid || String(cityCampaigns[0].id));
    }
  }, [propSelectedCampaignId, campaigns, cityCampaigns, internalCampaignId]);

  const activeCampaignId = internalCampaignId;
  const activeCampaign = campaigns.find((c) => c.uuid === activeCampaignId || String(c.id) === activeCampaignId);

  const handleCampaignChange = (newCampaignId: string) => {
    const targetCamp = campaigns.find((c) => c.uuid === newCampaignId || String(c.id) === newCampaignId);
    const resolvedId = targetCamp?.uuid || newCampaignId;
    setInternalCampaignId(resolvedId);
    if (onSelectCampaignId) onSelectCampaignId(resolvedId);
    if (targetCamp && String(targetCamp.cityId) !== String(selectedCityId) && onSelectCityId) {
      onSelectCityId(targetCamp.cityId);
    }
  };

  const handleDeleteCampaign = async () => {
    if (!activeCampaignId) return;
    const targetCamp = campaigns.find((c) => c.uuid === activeCampaignId || String(c.id) === activeCampaignId);
    const resolvedId = targetCamp?.uuid || activeCampaignId;

    const result = await Swal.fire({
      title: 'Supprimer cette campagne ?',
      text: 'Cette action est irréversible et supprimera également tous les trajets associés.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      confirmButtonText: 'Oui, supprimer',
      cancelButtonText: 'Annuler'
    });

    if (result.isConfirmed) {
      try {
        await api.deleteCampaign(resolvedId);
        Swal.fire({
          title: 'Campagne supprimée',
          text: 'La campagne a été retirée avec succès.',
          icon: 'success',
          timer: 1500,
          showConfirmButton: false
        });
        if (onRefresh) onRefresh();
      } catch (err: any) {
        Swal.fire({
          title: 'Erreur',
          text: err.message || 'Impossible de supprimer la campagne.',
          icon: 'error'
        });
      }
    }
  };

  return {
    cityCampaigns,
    activeCampaignId,
    activeCampaign,
    handleCampaignChange,
    handleDeleteCampaign
  };
}
