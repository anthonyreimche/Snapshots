//#region src/compare.ts
var e = "compare.reference";
function t(e, t) {
	return e && e.source === "snapshots" && e.photoId === t ? e.id : null;
}
//#endregion
//#region src/diff.ts
function n(e, t) {
	let { masks: n = [], ...a } = e.params, { masks: o = [], ...s } = t.params;
	return [
		...r("param", a, s),
		...i(n, o),
		...r("bag", e.paramBag ?? {}, t.paramBag ?? {})
	];
}
function r(e, t, n) {
	return [.../* @__PURE__ */ new Set([...Object.keys(n), ...Object.keys(t)])].filter((e) => !a(t[e], n[e])).map((r) => ({
		kind: e,
		key: r,
		before: t[r],
		after: n[r]
	}));
}
function i(e, t) {
	let n = new Map(e.map((e) => [e.id, e])), r = new Set(t.map((e) => e.id)), i = [];
	for (let e of t) {
		let t = n.get(e.id);
		t ? a(t, e) || i.push({
			kind: "mask",
			id: e.id,
			name: e.name,
			change: "edited"
		}) : i.push({
			kind: "mask",
			id: e.id,
			name: e.name,
			change: "added"
		});
	}
	for (let t of e) r.has(t.id) || i.push({
		kind: "mask",
		id: t.id,
		name: t.name,
		change: "removed"
	});
	return i;
}
function a(e, t) {
	if (e === t || Number.isNaN(e) && Number.isNaN(t)) return !0;
	if (typeof e != "object" || typeof t != "object" || e === null || t === null || Array.isArray(e) !== Array.isArray(t)) return !1;
	let n = Object.entries(e).filter(([, e]) => e !== void 0), r = new Map(Object.entries(t).filter(([, e]) => e !== void 0));
	return n.length === r.size && n.every(([e, t]) => r.has(e) && a(t, r.get(e)));
}
//#endregion
//#region src/format.ts
var o = /* @__PURE__ */ new Set([
	"hsl",
	"nr",
	"wb",
	"ev",
	"lut",
	"rgb",
	"ca"
]);
function s(e) {
	let t = e.replace(/([a-z\d])([A-Z])/g, "$1 $2").replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2").split(/[\s_-]+/).filter(Boolean).map((e) => o.has(e.toLowerCase()) ? e.toUpperCase() : e.toLowerCase()).map((e) => e.replace(/^colo(?=r)/, "colou")).join(" ");
	return t.charAt(0).toUpperCase() + t.slice(1);
}
function c(e, t) {
	if (e.kind === "param") return s(e.key);
	let n = t(e.key);
	if (!n) return s(e.key.slice(e.key.lastIndexOf(".") + 1));
	let r = n.label ?? s(n.localKey);
	return r.startsWith(n.stageName) ? r : `${n.stageName} › ${r}`;
}
function l(e, t) {
	if (e.kind === "param") return [e.before, e.after];
	let n = t(e.key)?.default;
	return [e.before ?? n, e.after ?? n];
}
function u(e) {
	return e == null ? "—" : typeof e == "number" ? String(Math.round(e * 100) / 100) : typeof e == "boolean" ? e ? "On" : "Off" : typeof e == "string" && e.length <= 24 ? e : null;
}
function d(e, t) {
	if (e.kind === "mask") return `${e.name ? `Mask “${e.name}”` : "Mask"} ${e.change}`;
	let n = c(e, t), [r, i] = l(e, t).map(u);
	return r === null || i === null ? `${n} edited` : `${n}: ${r} → ${i}`;
}
function f(e) {
	return e.length === 0 ? "" : e.length === 1 ? "1 change" : `${e.length} changes`;
}
function p(e, t, n) {
	if (t.length === 0) return `Taken ${e}\nThe edit shown`;
	let r = t.slice(0, 12).map((e) => d(e, n));
	return t.length > 12 && r.push(`and ${t.length - 12} more`), [`Taken ${e}`, ...r].join("\n");
}
//#endregion
//#region src/rt.ts
var m, h;
function g(e) {
	h = e, m = e.react;
}
//#endregion
//#region src/snapshots.ts
var _ = "snapshots", v = 1, y = "Snapshot ";
function b(e, t, n, r) {
	let { params: i, paramBag: a = {} } = JSON.parse(JSON.stringify(e));
	return {
		id: n,
		name: t,
		taken: r,
		params: i,
		paramBag: a
	};
}
function x(e) {
	let t = e.map((e) => e.name.startsWith(y) ? Number(e.name.slice(9)) : 0).filter((e) => Number.isInteger(e) && e > 0);
	return `${y}${Math.max(0, ...t) + 1}`;
}
function ee(e) {
	return new TextEncoder().encode(JSON.stringify({
		format: v,
		snapshots: e
	}));
}
function te(e) {
	if (!e || e.length === 0) return [];
	let t;
	try {
		t = JSON.parse(new TextDecoder().decode(e));
	} catch {
		return null;
	}
	return !C(t) || t.format !== v || !Array.isArray(t.snapshots) ? null : t.snapshots.filter(w);
}
function S(e, t, n) {
	let r = { ...e.paramBag };
	for (let e of Object.keys(t)) {
		if (e in r) continue;
		let t = n(e)?.default;
		t !== void 0 && (r[e] = t);
	}
	return r;
}
function C(e) {
	return typeof e == "object" && !!e && !Array.isArray(e);
}
function w(e) {
	return C(e) && typeof e.id == "string" && typeof e.name == "string" && Number.isFinite(e.taken) && C(e.params) && C(e.paramBag);
}
//#endregion
//#region src/store.ts
var ne = {
	photoId: null,
	snapshots: [],
	status: "idle",
	canCompare: !1,
	reference: null,
	previewing: null
}, T = null, E = null;
function D() {
	if (!T) throw Error("[snapshots] store used before activate()");
	return T;
}
function O() {
	T = h.stores.create()(() => ({ ...ne }));
	let t = h.stores.useDevelopStore;
	k(t.getState().photoId);
	let n = t.subscribe((e, t) => {
		e.photoId !== t.photoId && k(e.photoId);
	}), r = h.variables.subscribe(e, (e) => {
		D().setState({
			canCompare: !0,
			reference: e.value
		});
	});
	return () => {
		n(), r(), F(null), L();
	};
}
function k(e) {
	L();
	let t = D();
	t.setState({
		photoId: e,
		snapshots: [],
		status: e ? "loading" : "idle",
		previewing: null
	}), e && h.develop.getPhotoData(_).then((n) => {
		if (t.getState().photoId !== e) return;
		let r = te(n);
		t.setState(r ? {
			snapshots: r,
			status: "ready"
		} : { status: "unreadable" });
	}, () => {
		t.getState().photoId === e && t.setState({ status: "unreadable" });
	});
}
function A(e) {
	let t = D(), { photoId: n, status: r } = t.getState();
	return r !== "ready" || !n || h.stores.useDevelopStore.getState().photoId !== n ? !1 : (t.setState({ snapshots: e }), h.develop.putPhotoData(_, e.length > 0 ? ee(e) : null), !0);
}
var j = (e) => D().getState().snapshots.find((t) => t.id === e);
function M() {
	let { params: e, paramBag: t, editError: n } = h.stores.useDevelopStore.getState();
	if (n) return;
	let { snapshots: r } = D().getState();
	A([...r, b({
		params: e,
		paramBag: t
	}, x(r), crypto.randomUUID(), Date.now())]);
}
function N(e, t) {
	let n = t.trim(), r = j(e);
	if (!r || !n || n === r.name) return;
	let i = {
		...r,
		name: n
	};
	A(D().getState().snapshots.map((t) => t.id === e ? i : t)) && I(e, (e) => ({
		...e,
		label: n
	}));
}
function P(e) {
	A(D().getState().snapshots.filter((t) => t.id !== e)) && (D().getState().previewing === e && F(null), I(e, () => null), E?.id === e && (E = null));
}
function re(e) {
	let t = j(e);
	if (!t) return Promise.resolve();
	D().setState({ previewing: null });
	let { params: n, paramBag: r } = t;
	return h.stores.useDevelopStore.getState().restoreEdit({
		params: n,
		paramBag: r
	}, `Snapshot “${t.name}”`);
}
function F(e) {
	let t = D(), n = h.stores.useDevelopStore.getState(), r = e === null ? void 0 : j(e);
	if (r) t.setState({ previewing: r.id }), n.setPreviewParams(r.params, S(r, n.paramBag, (e) => h.params.get(e)));
	else {
		if (t.getState().previewing === null) return;
		t.setState({ previewing: null }), n.setPreviewParams(null);
	}
}
function ie(e) {
	let n = j(e), { photoId: r } = D().getState();
	if (!n || !r) return;
	let i = !1;
	h.variables.update("compare.reference", (a) => {
		if (i = t(a, r) !== e, !i) return null;
		let { params: o, paramBag: s } = n;
		return {
			photoId: r,
			source: "snapshots",
			id: e,
			label: n.name,
			params: o,
			paramBag: s
		};
	}).ok && (E = i ? {
		photoId: r,
		id: e
	} : null);
}
function I(n, r) {
	let { reference: i, photoId: a } = D().getState();
	t(i, a) === n && h.variables.update(e, (e) => e && t(e, a) === n ? r(e) : e);
}
function L() {
	let n = E;
	n && (E = null, h.variables.update(e, (e) => t(e, n.photoId) === n.id ? null : e));
}
//#endregion
//#region src/SnapshotsPanel.tsx
var R = "snapshots-panel-list", z = "snapshots-panel-item", B = "snapshots-panel-row", V = "snapshots-panel-label", H = "snapshots-panel-detail", U = "snapshots-panel-action", W = "snapshots-panel-note";
function G(e) {
	return `
:where(.snapshots-panel) { display: flex; flex-direction: column; gap: 0.25rem; padding: 0.25rem; }
:where(.${R}) { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 1px; max-height: 20rem; overflow-y: auto; }
:where(.${z}) { display: flex; align-items: center; gap: 1px; border-radius: 0.25rem; }
:where(.${z}:hover), :where(.${z}:focus-within) { background-color: ${e.surface3}; }
:where(.${B}) { display: flex; flex: 1; min-width: 0; align-items: baseline; gap: 0.5rem; border-radius: 0.25rem; padding: 0.25rem 0.5rem; background-color: transparent; font-size: 11px; text-align: left; color: ${e.textSecondary}; cursor: pointer; touch-action: none; }
:where(.${z}:hover .${B}) { color: ${e.textPrimary}; }
:where(.${B}[aria-current="true"]) { color: ${e.textPrimary}; box-shadow: inset 2px 0 0 ${e.accent}; }
:where(.${B}[data-previewing]) { color: ${e.textPrimary}; background-color: ${e.surface3}; }
:where(.${V}) { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
:where(.${H}) { flex: none; color: ${e.textMuted}; font-variant-numeric: tabular-nums; }
@media (hover: hover) { :where(.${z}:not(:hover):not(:focus-within) .${U}:not([aria-pressed="true"])) { opacity: 0; } }
:where(.${W}) { padding: 0.25rem 0.5rem; font-size: 11px; color: ${e.textMuted}; }
html.sl-larger-text .${B}, html.sl-larger-text .${W} { font-size: 13px !important; line-height: 1.45 !important; }
`;
}
var K = new Intl.DateTimeFormat(void 0, {
	dateStyle: "medium",
	timeStyle: "short"
});
function q() {
	let e = D(), r = e((e) => e.snapshots), i = e((e) => e.status), a = e((e) => e.photoId), o = e((e) => e.canCompare), s = e((e) => t(e.reference, e.photoId)), c = e((e) => e.previewing), l = h.stores.useDevelopStore, u = l((e) => e.params), d = l((e) => e.paramBag), g = l((e) => e.editError), [_, v] = m.useState(null);
	if (g) return /* @__PURE__ */ m.createElement("div", { className: W }, "This photo's edit couldn't be read.");
	if (!a) return /* @__PURE__ */ m.createElement("div", { className: W }, "No photo open");
	if (i === "unreadable") return /* @__PURE__ */ m.createElement("div", { className: W }, "This photo's snapshots couldn't be read. Snapshots kept by a newer version of Snapshots need that version.");
	let y = {
		params: u,
		paramBag: d
	}, b = (e) => h.params.get(e), { Button: x } = h.ui;
	return /* @__PURE__ */ m.createElement("div", { className: "snapshots-panel" }, /* @__PURE__ */ m.createElement(x, {
		size: "sm",
		variant: "secondary",
		full: !0,
		disabled: i !== "ready",
		onClick: M,
		title: "Keep the edit shown as a snapshot"
	}, "+ Snapshot"), i === "ready" && r.length === 0 && /* @__PURE__ */ m.createElement("div", { className: "snapshots-panel-note" }, "No snapshots yet. Take one to come back to this edit later."), r.length > 0 && /* @__PURE__ */ m.createElement("ol", {
		className: "snapshots-panel-list",
		"aria-label": "Snapshots"
	}, r.map((e) => {
		let t = n(y, e);
		return /* @__PURE__ */ m.createElement("li", {
			key: e.id,
			className: "snapshots-panel-item"
		}, _ === e.id ? /* @__PURE__ */ m.createElement(ae, {
			snapshot: e,
			onDone: () => v(null)
		}) : /* @__PURE__ */ m.createElement(J, {
			snapshot: e,
			current: t.length === 0,
			previewing: c === e.id,
			detail: f(t),
			title: p(K.format(e.taken), t, b),
			onRename: () => v(e.id)
		}), o && /* @__PURE__ */ m.createElement(x, {
			variant: "ghost",
			size: "sm",
			className: "snapshots-panel-action",
			active: s === e.id,
			"aria-pressed": s === e.id,
			"aria-label": `Compare with “${e.name}”`,
			title: "Compare the edit shown with this snapshot",
			onClick: () => ie(e.id)
		}, "⇆"), /* @__PURE__ */ m.createElement(x, {
			variant: "ghost",
			size: "sm",
			className: "snapshots-panel-action",
			"aria-label": `Rename “${e.name}”`,
			title: "Rename",
			onClick: () => v(e.id)
		}, "✎"), /* @__PURE__ */ m.createElement(x, {
			variant: "ghost",
			size: "sm",
			className: "snapshots-panel-action",
			"aria-label": `Delete “${e.name}”`,
			title: "Delete",
			onClick: () => P(e.id)
		}, "✕"));
	})));
}
function J({ snapshot: e, current: t, previewing: n, detail: r, title: i, onRename: a }) {
	let o = m.useRef(null), s = m.useRef(!1), c = () => {
		o.current !== null && clearTimeout(o.current), o.current = null, s.current && F(null);
	};
	return m.useEffect(() => c, []), /* @__PURE__ */ m.createElement("button", {
		className: B,
		"aria-current": t ? "true" : void 0,
		"data-previewing": n ? "" : void 0,
		title: i,
		onPointerDown: (t) => {
			t.button === 0 && (s.current = !1, o.current = setTimeout(() => {
				o.current = null, s.current = !0, F(e.id);
			}, 250));
		},
		onPointerUp: c,
		onPointerCancel: c,
		onPointerLeave: c,
		onClick: () => {
			s.current ? s.current = !1 : re(e.id);
		},
		onDoubleClick: a,
		onKeyDown: (e) => {
			e.key === "F2" && (e.preventDefault(), a());
		}
	}, /* @__PURE__ */ m.createElement("span", { className: V }, e.name), /* @__PURE__ */ m.createElement("span", { className: H }, r));
}
function ae({ snapshot: e, onDone: t }) {
	let [n, r] = m.useState(e.name), i = m.useRef(!1), a = (r) => {
		i.current || (i.current = !0, r && N(e.id, n), t());
	};
	m.useEffect(() => h.ui.onEscape(() => a(!1)), []);
	let { TextInput: o } = h.ui;
	return /* @__PURE__ */ m.createElement(o, {
		value: n,
		onChange: r,
		autoFocus: !0,
		"aria-label": "Snapshot name",
		style: {
			flex: 1,
			minWidth: 0
		},
		onFocus: (e) => e.currentTarget.select(),
		onBlur: () => a(!0),
		onKeyDown: (e) => {
			e.key === "Enter" && a(!0);
		}
	});
}
//#endregion
//#region src/index.tsx
var Y = "snapshots", X = `${Y}.panel`, Z = `${Y}.styles`, Q = `${Y}.take`, $ = null;
function oe(e) {
	g(e), $ = O(), e.registerStylesheet({
		id: Z,
		css: G(e.ui.tokens)
	}), e.registerPanel({
		id: X,
		title: "Snapshots",
		component: q,
		defaultDock: {
			module: "develop",
			direction: "left",
			order: 4,
			width: 240,
			height: 200
		},
		modules: ["develop"]
	}), e.registerKeybinding({
		id: Q,
		label: "Take snapshot",
		category: "Develop",
		defaultCombo: "Ctrl+N",
		handler: () => {
			e.navigation.current() === "develop" && M();
		}
	});
}
function se() {
	$?.(), $ = null;
}
//#endregion
export { Y as EXTENSION_ID, X as PANEL_ID, Z as STYLESHEET_ID, Q as TAKE_ACTION, oe as activate, se as deactivate };

//# sourceMappingURL=index.js.map