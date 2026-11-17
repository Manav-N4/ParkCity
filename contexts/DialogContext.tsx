import React, {
  createContext,
  useCallback,
  useContext,
  useState,
} from 'react';

import AppDialog, {
  type DialogConfig,
} from '../components/ui/AppDialog';

type DialogContextValue = {
  showDialog: (config: DialogConfig) => void;
  hideDialog: () => void;
};

const DialogContext = createContext<DialogContextValue | undefined>(
  undefined,
);

export function DialogProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [dialog, setDialog] = useState<DialogConfig | null>(null);

  const showDialog = useCallback((config: DialogConfig) => {
    setDialog(config);
  }, []);

  const hideDialog = useCallback(() => {
    setDialog(null);
  }, []);

  return (
    <DialogContext.Provider value={{ showDialog, hideDialog }}>
      {children}

      <AppDialog
        visible={dialog !== null}
        config={dialog}
        onClose={hideDialog}
      />
    </DialogContext.Provider>
  );
}

export function useDialog() {
  const context = useContext(DialogContext);

  if (!context) {
    throw new Error('useDialog must be used within DialogProvider');
  }

  return context;
}
