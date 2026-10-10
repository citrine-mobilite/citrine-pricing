import { useState, useEffect, useMemo } from 'react';
import Swal from 'sweetalert2';
import { City, PricingCampaign, TripResult } from '../../types';
import { api } from '../../services/api';

export function usePricingCampaign(
  campaigns: PricingCampaign[],
  selectedCityId: string,
  propSelectedCampaignId?: string | null,
  onSelectCampaignId?: (id: string) => void,
  onSelectCityId?: (id: string) => void,
  onRefresh?: () => void
) {
  const cityCampaigns = useMemo(
    () => campaigns.filter((c) => c.cityId === selectedCityId),
    [campaigns, selectedCityId]
  );

  const [internalCampaignId, setInternalCampaignId] = useState<string>(() => {
    if (propSelectedCampaignId && campaigns.some((c) => String(c.id) === String(propSelectedCampaignId))) {
      return String(propSelectedCampaignId);
    }
    return String(cityCampaigns[0]?.id || campaigns[0]?.id || '');
  });

  useEffect(() => {
    if (propSelectedCampaignId) {
      setInternalCampaignId(String(propSelectedCampaignId));
    } else if (!internalCampaignId) {
      const activeForCity = campaigns.filter((c) => c.cityId === selectedCityId);
      if (activeForCity.length > 0) {
        setInternalCampaignId(String(activeForCity[0].id));
      }
    }
  }, [propSelectedCampaignId, campaigns, selectedCityId, internalCampaignId]);

  const activeCampaignId = internalCampaignId;
  const activeCampaign = campaigns.find((c) => String(c.id) === String(activeCampaignId));

  const handleCampaignChange = (newCampaignId: string) => {
    setInternalCampaignId(newCampaignId);
    if (onSelectCampaignId) onSelectCampaignId(newCampaignId);
    const targetCamp = campaigns.find((c) => String(c.id) === String(newCampaignId));
    if (targetCamp && targetCamp.cityId !== selectedCityId && onSelectCityId) {
      onSelectCityId(targetCamp.cityId);
    }
  };

  const handleDeleteCampaign = async () => {
    if (!activeCampaignId) return;
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
        await api.deleteCampaign(activeCampaignId);
        const otherCampaigns = campaigns.filter(
          (c) => String(c.id) !== String(activeCampaignId) && c.cityId === selectedCityId
        );
        const nextId = otherCampaigns[0]?.id || campaigns.filter((c) => String(c.id) !== String(activeCampaignId))[0]?.id || '';
        handleCampaignChange(String(nextId));
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
