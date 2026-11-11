import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';

export function useAndroidBackButton() {
  const navigate = useNavigate();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let removeListener: (() => void) | undefined;

    App.addListener('backButton', ({ canGoBack }) => {
      if (canGoBack || window.history.length > 1) {
        navigate(-1);
      } else {
        App.exitApp();
      }
    }).then(handle => {
      removeListener = handle.remove;
    });

    return () => {
      removeListener?.();
    };
  }, [navigate]);
}
