import { useState, useEffect, useMemo } from 'react';
import Swal from 'sweetalert2';
import { City, PricingCampaign, TripResult } from '../../types';
import { api } from '../../services/api';

export function usePricingCampaign(
  campaigns: PricingCampaign[],
  selectedCityId: string,
  propSelectedCampaignId?: string | number | null,
  onSelectCampaignId?: (id: string) => void,
  onSelectCityId?: (id: string) => void,
  onRefresh?: () => void
) {
  const cityCampaigns = useMemo(
    () => campaigns.filter((c) => c.cityId === selectedCityId),
    [campaigns, selectedCityId]
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
    if (targetCamp && targetCamp.cityId !== selectedCityId && onSelectCityId) {
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
        const otherCampaigns = cityCampaigns.filter(
          (c) => c.uuid !== resolvedId && String(c.id) !== resolvedId
        );
        const nextCamp = otherCampaigns[0] || campaigns.find((c) => c.uuid !== resolvedId && String(c.id) !== resolvedId);
        const nextId = nextCamp ? (nextCamp.uuid || String(nextCamp.id)) : '';
        handleCampaignChange(nextId);
        if (onRefresh) await onRefresh();
        Swal.fire({ title: 'Supprimée !', text: 'Campagne supprimée.', icon: 'success', timer: 1500, showConfirmButton: false });
      } catch (err: any) {
        Swal.fire('Erreur', err?.message || 'Erreur lors de la suppression.', 'error');
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
