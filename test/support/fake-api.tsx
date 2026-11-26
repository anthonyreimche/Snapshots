// A stand-in Safelight API over real React and zustand. The develop store holds
// an open photo's edit; restoreEdit and setPreviewParams are recorded and act as
// core's do. Photo data is kept per photo, shared variables in memory, and every
// registration is recorded.

import * as React from "react";
import { create } from "zustand";
import type {
  ButtonProps,
  DevelopStoreState,
  Edit,
  EditParams,
  KeyActionContribution,
  PanelContribution,
  ParamDescriptor,
  SafelightAPI,
  SharedVariablesAPI,
  StoreApi,
  StylesheetContribution,
  TextInputProps,
  UiTokens,
  VariableSnapshot,
} from "../../src/safelight";

export const TOKENS: UiTokens = {
  surface3: "var(--color-surface-3)",
  textPrimary: "var(--color-text-primary)",
  textSecondary: "var(--color-text-secondary)",
  textMuted: "var(--color-text-muted)",
  accent: "var(--color-accent)",
};

export interface Restored {
  edit: Edit;
  label: string;
}

export interface Rig {
  api: SafelightAPI;
  develop: StoreApi<DevelopStoreState>;
  ui: StoreApi<{ activeModule: string }>;
  /** Stored photo data by photo id, then key. */
  photoData: Map<string, Map<string, Uint8Array>>;
  /** Reads held back by `holdReads`, to answer by hand. */
  heldReads: { photoId: string; answer(): void }[];
  restored: Restored[];
  /** Every setPreviewParams call: the params and bag, or null to clear. */
  previews: ({ params: EditParams; paramBag: Readonly<Record<string, unknown>> | null | undefined } | null)[];
  variables: Map<string, unknown>;
  /** Register a shared variable the way another extension (a compare tool) would. */
  registerVariable(name: string, initial: unknown): void;
  /** The handler a running onEscape registration holds, or null. */
  escape(): (() => void) | null;
  panels: PanelContribution[];
  stylesheets: StylesheetContribution[];
  keybindings: KeyActionContribution[];
  /** Open a photo, as loadEdit does. */
  openPhoto(photoId: string | null, params?: EditParams, paramBag?: Record<string, unknown>): void;
}

export function fakeApi({
  photoId = "photo-1",
  params = { exposure: 0, contrast: 0 },
  paramBag = {},
  descriptors = {},
  holdReads = false,
}: {
  photoId?: string | null;
  params?: EditParams;
  paramBag?: Record<string, unknown>;
  descriptors?: Record<string, ParamDescriptor>;
  holdReads?: boolean;
} = {}): Rig {
  const restored: Restored[] = [];
  const previews: Rig["previews"] = [];
  const panels: PanelContribution[] = [];
  const stylesheets: StylesheetContribution[] = [];
  const keybindings: KeyActionContribution[] = [];
  const photoData = new Map<string, Map<string, Uint8Array>>();
  const heldReads: Rig["heldReads"] = [];
  const escapes: (() => void)[] = [];

  const develop: StoreApi<DevelopStoreState> = create<DevelopStoreState>()((set) => ({
    photoId,
    params,
    paramBag,
    editError: null,
    restoreEdit: async (edit, label) => {
      restored.push({ edit, label });
      set({ params: edit.params, paramBag: edit.paramBag ?? {} });
    },
    setPreviewParams: (p, bag) => void previews.push(p === null ? null : { params: p, paramBag: bag }),
  }));
  const ui: StoreApi<{ activeModule: string }> = create<{ activeModule: string }>()(() => ({ activeModule: "develop" }));

  const values = new Map<string, unknown>();
  const listeners = new Map<string, Set<(s: VariableSnapshot<unknown>) => void>>();
  const deliver = (name: string) => {
    for (const listener of listeners.get(name) ?? []) listener({ name, value: values.get(name) });
  };
  const variables: SharedVariablesAPI = {
    get: <T,>(name: string) => (values.has(name) ? { name, value: values.get(name) as T } : undefined),
    subscribe: <T,>(name: string, listener: (s: VariableSnapshot<T>) => void) => {
      const held = listeners.get(name) ?? new Set();
      const wide = listener as (s: VariableSnapshot<unknown>) => void;
      held.add(wide);
      listeners.set(name, held);
      if (values.has(name)) wide({ name, value: values.get(name) });
      return () => void held.delete(wide);
    },
    update: <T,>(name: string, fn: (current: T) => T) => {
      if (!values.has(name)) return { ok: false, reason: "unregistered" } as const;
      values.set(name, JSON.parse(JSON.stringify(fn(values.get(name) as T))));
      deliver(name);
      return { ok: true } as const;
    },
  };

  const Button = ({ variant: _v, size: _s, active: _a, full: _f, ...rest }: ButtonProps) => <button data-kit="button" data-variant={_v} data-size={_s} {...rest} />;
  const TextInput = ({ value, onChange, ...rest }: TextInputProps) => (
    <input {...rest} value={value} onChange={(e) => onChange(e.currentTarget.value)} />
  );

  const api: SafelightAPI = {
    version: 1,
    extensionId: "snapshots",
    react: React,
    registerPanel: (c) => void panels.push(c),
    registerStylesheet: (c) => void stylesheets.push(c),
    registerKeybinding: (c) => void keybindings.push(c),
    ui: {
      tokens: TOKENS,
      Button,
      TextInput,
      onEscape: (handler) => {
        escapes.push(handler);
        return () => {
          const at = escapes.lastIndexOf(handler);
          if (at >= 0) escapes.splice(at, 1);
        };
      },
    },
    params: { get: (key) => descriptors[key] },
    navigation: { current: () => ui.getState().activeModule },
    stores: { useDevelopStore: develop, create },
    develop: {
      putPhotoData: (key, data) => {
        const id = develop.getState().photoId;
        if (!id) return;
        const held = photoData.get(id) ?? new Map<string, Uint8Array>();
        if (data) held.set(key, data);
        else held.delete(key);
        photoData.set(id, held);
      },
      getPhotoData: (key) => {
        const id = develop.getState().photoId;
        const read = () => (id ? (photoData.get(id)?.get(key) ?? null) : null);
        if (!holdReads || !id) return Promise.resolve(read());
        return new Promise((resolve) => heldReads.push({ photoId: id, answer: () => resolve(read()) }));
      },
    },
    variables,
  };

  return {
    api,
    develop,
    ui,
    photoData,
    heldReads,
    restored,
    previews,
    variables: values,
    registerVariable: (name, initial) => {
      if (values.has(name)) return;
      values.set(name, initial);
      deliver(name);
    },
    escape: () => escapes.at(-1) ?? null,
    panels,
    stylesheets,
    keybindings,
    openPhoto: (id, p = { exposure: 0, contrast: 0 }, bag = {}) =>
      develop.setState({ photoId: id, params: p, paramBag: bag, editError: null }),
  };
}
