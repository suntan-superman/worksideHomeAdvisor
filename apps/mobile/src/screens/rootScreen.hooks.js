import { useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Keyboard, Platform } from 'react-native';

import { formatPhoneInput } from './rootScreen.helpers.js';

export function useDefaultPropertySelection({
  sessionUserId,
  properties,
  propertyId,
  setPropertyId,
  setPropertySection,
}) {
  useEffect(() => {
    if (!sessionUserId) {
      setPropertyId('');
      return;
    }

    if (!properties.length) {
      setPropertyId('');
      return;
    }

    if (properties.some((property) => property.id === propertyId)) {
      return;
    }

    setPropertyId(properties[0]?.id || '');
    setPropertySection('overview');
  }, [sessionUserId, properties, propertyId, setPropertyId, setPropertySection]);
}

export function useDefaultAssetSelection({ gallery, selectedAssetId, setSelectedAssetId }) {
  useEffect(() => {
    if (!gallery.length) {
      setSelectedAssetId('');
      return;
    }

    if (gallery.some((asset) => asset.id === selectedAssetId)) {
      return;
    }

    setSelectedAssetId(gallery[0]?.id || '');
  }, [gallery, selectedAssetId, setSelectedAssetId]);
}

export function useDefaultVariantSelection({ mediaVariants, selectedVariantId, setSelectedVariantId }) {
  useEffect(() => {
    if (!mediaVariants.length) {
      setSelectedVariantId('');
      return;
    }

    if (mediaVariants.some((variant) => variant.id === selectedVariantId)) {
      return;
    }

    setSelectedVariantId(
      mediaVariants.find((variant) => variant.isSelected)?.id || mediaVariants[0]?.id || '',
    );
  }, [mediaVariants, selectedVariantId, setSelectedVariantId]);
}

export function useRememberedEmail({ storageKey, setRememberedEmail, setForm }) {
  useEffect(() => {
    let active = true;

    async function loadRememberedEmail() {
      try {
        const storedEmail = await AsyncStorage.getItem(storageKey);
        if (active && storedEmail) {
          setRememberedEmail(storedEmail);
          setForm((current) =>
            current.email
              ? current
              : {
                  ...current,
                  email: storedEmail,
                },
          );
        }
      } catch {
        // Keep auth usable even if local storage is unavailable.
      }
    }

    loadRememberedEmail();

    return () => {
      active = false;
    };
  }, [setForm, setRememberedEmail, storageKey]);
}

export function useKeyboardVisibility(setKeyboardVisible) {
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSubscription = Keyboard.addListener(showEvent, () => {
      setKeyboardVisible(true);
    });
    const hideSubscription = Keyboard.addListener(hideEvent, () => {
      setKeyboardVisible(false);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, [setKeyboardVisible]);
}

export function useSyncAccountFormFromSession({ session, setAccountForm }) {
  useEffect(() => {
    setAccountForm({
      firstName: session?.user?.firstName || '',
      lastName: session?.user?.lastName || '',
      mobilePhone: formatPhoneInput(session?.user?.mobilePhone || ''),
      smsOptIn: Boolean(session?.user?.smsOptIn),
    });
  }, [
    session?.user?.firstName,
    session?.user?.lastName,
    session?.user?.mobilePhone,
    session?.user?.smsOptIn,
    setAccountForm,
  ]);
}
