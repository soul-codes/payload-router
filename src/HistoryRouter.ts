import Router, { RouterSettings } from "./Router";

const $history = "history-router-state-b3ca3f75-de2f-4bb6-808a-4b7f88c0d2ce";
interface IHistoryState<TPayload> {
  [$history]: number;
  payload: TPayload;
}

let counter = 0;

export default class HistoryRouter<TPayload> extends Router<TPayload> {
  private _lastState: IHistoryState<TPayload> | null = null;
  private _isResolvingCancelledDefer = false;
  private _isResolvingHashChange = false;

  constructor(settings: RouterSettings<TPayload>) {
    super({
      ...settings
    });
    this.onDefer(() => this._handleDefer());
    this.onPayloadChange(ev => this._handlePayloadChange(ev));
    this.onCancel(() => this._handleCancel());
  }

  start() {
    window.addEventListener("hashchange", () => {
      if (this._isResolvingCancelledDefer) return;
      const { payload } = this._ensureHistoryState();
      this._isResolvingHashChange = true;
      this.navigate(payload).then(() => {});
    });

    const { payload, [$history]: startCounter } = this._ensureHistoryState();
    counter = startCounter;
    return super.start(payload);
  }

  private _handleDefer() {
    console.log("defer", window.history.state, this.payload, this.nextPayload);
  }

  private _handlePayloadChange(ev: { replace: boolean }) {
    const hash = "#" + this.routeString;
    let state = this._ensureHistoryState();
    state = { ...state, payload: this.payload };
    if (ev.replace || this._isResolvingHashChange) {
      window.history.replaceState(state, "", hash);
    } else {
      window.history.pushState(state, "", hash);
    }

    this._lastState = state;
    this._isResolvingHashChange = false;
  }

  private _handleCancel() {
    const lastState = <IHistoryState<TPayload>>this._lastState;
    this._isResolvingCancelledDefer = true;
    const correctRoute = () => {
      const currentState: IHistoryState<TPayload> = window.history.state;
      if (currentState[$history] > lastState[$history]) window.history.back();
      else if (currentState[$history] < lastState[$history])
        window.history.forward();
      else {
        this._isResolvingCancelledDefer = false;
        window.removeEventListener("hashchange", correctRoute);
      }
    };
    window.addEventListener("hashchange", correctRoute);
    correctRoute();
  }

  private _ensureHistoryState() {
    let state: IHistoryState<TPayload> = window.history.state;
    if (state && state[$history]) return state;

    const { hash } = window.location;
    const payload = this.transduce(dehash(hash));
    state = { [$history]: ++counter, payload };
    window.history.replaceState(state, "", hash);
    return state;
  }
}

function dehash(routeString: string) {
  return routeString[0] === "#" ? routeString.substr(1) : routeString;
}
