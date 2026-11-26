// Safelight — founded and principally authored by Anthony Reimche.
// Copyright (C) 2026 Anthony Reimche. Licensed under the GNU GPL v3 with an
// attribution-preservation term (GPL v3 §7b) — see LICENSE. This notice must
// be preserved in derived versions.

// The slice of Safelight's extension API this extension touches, mirrored from
// the app's extension-types/safelight.d.ts. Extensions are standalone bundles,
// so the host's source is not on the type path; React types come from
// @types/react (dev only).

import type { ButtonHTMLAttributes, ComponentType, InputHTMLAttributes, JSX } from "react";

export interface StoreApi<T> {
  (): T;
  <U>(selector: (state: T) => U): U;
  getState(): T;
  setState(partial: Partial<T> | ((s: T) => Partial<T>)): void;
  subscribe(listener: (state: T, prev: T) => void): () => void;
}

/** A mask as this extension reads it: told apart by id, named for the list. */
export interface MaskLike {
  id: string;
  name: string;
}

/** Core types params as DevelopParams. A snapshot read from disk carries
 *  whatever params the build that took it knew, so they are read by key here
 *  and handed back to core whole. */
export type EditParams = Readonly<Record<string, unknown>> & { masks?: readonly MaskLike[] };

/** A whole edit: core's settings and the extension values it holds. */
export interface Edit {
  params: EditParams;
  /** Extension stage params by qualified key ("{stageId}.{key}"). */
  paramBag?: Readonly<Record<string, unknown>>;
}

export interface DevelopStoreState {
  /** The open photo's id, or null with none open. */
  photoId: string | null;
  params: EditParams;
  paramBag: Readonly<Record<string, unknown>>;
  /** Why the open photo's stored edit couldn't be read, or null. */
  editError: string | null;
  /** Put the open photo's edit back to `edit` exactly, as one undoable step
   *  (Safelight 3.2.6). */
  restoreEdit(edit: Edit, label: string): Promise<void>;
  /** Draw `params` (and `paramBag`, merged over the live one) in place of the
   *  edit until cleared with null. Never saved. */
  setPreviewParams(params: EditParams | null, paramBag?: Readonly<Record<string, unknown>> | null): void;
}

/** What core knows about one extension stage param. */
export interface ParamDescriptor {
  qualifiedKey: string;
  localKey: string;
  stageId: string;
  stageName: string;
  extensionName: string;
  /** The value a stage reads while the edit holds none. */
  default: number | readonly number[] | boolean;
  label?: string;
}

export interface PanelDockDefault {
  module: "library" | "develop";
  direction: "left" | "right" | "bottom";
  order?: number;
  width?: number;
  height?: number;
}

export interface PanelContribution {
  id: string;
  title: string;
  component: ComponentType;
  defaultDock?: PanelDockDefault;
  /** The modules the panel may be docked in; omitted, every module (Safelight 3.2.8). */
  modules?: readonly string[];
}

export interface StylesheetContribution {
  id: string;
  css: string;
}

export interface KeyActionContribution {
  id: string;
  label: string;
  category?: "General" | "Develop" | "Library";
  defaultCombo: string;
  handler(): void;
}

/** The theme's CSS variables as `var(--color-…)` strings. */
export interface UiTokens {
  readonly surface3: string;
  readonly textPrimary: string;
  readonly textSecondary: string;
  readonly textMuted: string;
  readonly accent: string;
}

export type ModuleId = "library" | "develop" | (string & {});

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
  active?: boolean;
  full?: boolean;
}

export interface TextInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> {
  value: string;
  onChange: (value: string) => void;
}

export interface VariableSnapshot<T> {
  name: string;
  value: T;
}

export type VariableWriteResult =
  | { ok: true }
  | { ok: false; reason: "stale" | "unregistered" | "invalid" };

/** Named JSON values every extension can share, in every window. */
export interface SharedVariablesAPI {
  get<T>(name: string): VariableSnapshot<T> | undefined;
  /** Called at once if `name` exists, else on its registration; then on every write. */
  subscribe<T>(name: string, listener: (snapshot: VariableSnapshot<T>) => void): () => void;
  /** Read-modify-write on the latest value; refused while `name` is unregistered. */
  update<T>(name: string, fn: (current: T) => T): VariableWriteResult;
}

export interface SafelightAPI {
  version: 1;
  extensionId: string;
  react: typeof import("react");
  registerPanel(c: PanelContribution): void;
  registerStylesheet(c: StylesheetContribution): void;
  registerKeybinding(c: KeyActionContribution): void;
  ui: {
    tokens: UiTokens;
    Button: (props: ButtonProps) => JSX.Element;
    TextInput: (props: TextInputProps) => JSX.Element;
    /** Take the Escape key while something of this extension's is open; returns
     *  the function that gives it back. */
    onEscape(handler: () => void): () => void;
  };
  navigation: {
    /** The module this window shows: a popped-out window's own module, else the
     *  main window's tab. Needs Safelight 3.2.7. */
    current(): ModuleId;
  };
  params: {
    get(qualifiedKey: string): ParamDescriptor | undefined;
  };
  stores: {
    useDevelopStore: StoreApi<DevelopStoreState>;
    create: typeof import("zustand").create;
  };
  develop: {
    /** Store (or with null, delete) bytes for the open photo, under this extension's key. */
    putPhotoData(key: string, data: Uint8Array | null): void;
    /** The bytes stored for the open photo when called, or null. */
    getPhotoData(key: string): Promise<Uint8Array | null>;
  };
  variables: SharedVariablesAPI;
}

export interface ExtensionModule {
  activate(api: SafelightAPI): void;
  deactivate?(): void;
}
