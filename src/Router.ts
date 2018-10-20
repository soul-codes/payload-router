export enum RoutingState {
  /**
   * Represents the state where navigation is not active.
   */
  resting = "resting",

  /**
   * Represents the state where navigation is wished by a user but
   * the UI is reacting by deferring the navigation pending on some
   * conditions.
   */
  deferred = "deferred",

  /**
   * Represents the state where the navigation is being handled by
   * a handler.
   */
  active = "active"
}

type Falsy = null | false | void;

export interface RouteHandler<
  TPayload extends TOtherPayloads,
  TOtherPayloads = TPayload
> {
  (payload: TPayload, helpers: RouteHandlerHelpers<TOtherPayloads>):
    | Promise<void>
    | Falsy;
}

export interface RouteTransducer<TPayload> {
  (routeString: string): TPayload | Falsy;
}

export interface RoutePresenter<TPayload> {
  (payload: TPayload): string | Falsy;
}

export interface RouterStateThunks<TPayload> {
  getState?(next: () => RouterState<TPayload>): TPayload;
  setState?(next: () => any, newState: RouterState<TPayload>): any;
}

export interface RouterDeferrer<TPayload> {
  (payload: TPayload): boolean | Promise<boolean>;
}

export interface RouterState<TPayload> {
  routingState: RoutingState;
  nextPayload: TPayload | null;
  currentPayload: TPayload | null;
}

export interface RouteHandlerHelpers<TPayload> {
  redirect: (payload: TPayload) => Promise<void>;
  replace: (payload: TPayload) => void;
  handleCancel: (callback: () => any) => void;
  origin: TPayload | null;
  redirections: TPayload[];
}

type RecursiveArray<X> = MaybeRecursiveArray<X>[];
type MaybeRecursiveArray<X> = X | Nest<X>;
interface Nest<X> extends Array<MaybeRecursiveArray<X>> {}

export interface RouterSettings<TPayload> {
  routes: RecursiveArray<IRouteSettings<TPayload>>;
  deferer?: RouterDeferrer<TPayload>;
  stateThunks?: RouterStateThunks<TPayload>;
}

export interface IRouteSettings<TPayload> {
  transducer?: RouteTransducer<TPayload>;
  presenter?: RoutePresenter<TPayload>;
  handler?: RouteHandler<TPayload>;
}

const defaultThunk = (next: Function) => next();

export default class Router<TPayload> {
  private _state: RouterState<TPayload> = {
    routingState: RoutingState.resting,
    nextPayload: null,
    currentPayload: null
  };
  private _promise: Promise<void> | null = null;
  private _cancelHandlers: (() => any)[] = [];
  private _origin: TPayload | null = null;
  private _deferCallbacks: (() => any)[] = [];
  private _cancelCallbacks: (() => any)[] = [];
  private _payloadChangeCallbacks: (() => any)[] = [];

  constructor(readonly settings: RouterSettings<TPayload>) {}

  start(initialPayload: TPayload) {
    return this._activateNavigation(initialPayload);
  }

  navigate(payload: TPayload) {
    const { routingState } = this._state;
    if (routingState === RoutingState.deferred) {
      this._setState({ ...this._state, nextPayload: payload });
      return <Promise<void>>this._promise;
    }
    if (routingState === RoutingState.active) {
      const cancelHandler = [...this._cancelHandlers];
      this._cancelHandlers = [];
      this._promise = null;
      cancelHandler.forEach(handler => handler());
      this._activateNavigation(payload);
    } else {
      this._tryDeferNavigation(payload);
    }
    return this._promise || Promise.resolve();
  }

  transduce(routeString: string): TPayload {
    const { routes } = this;
    for (let i = 0, length = routes.length; i < length; i++) {
      const { transducer } = routes[i];
      const payload = transducer && transducer(routeString);
      if (payload) return payload;
    }

    throw Error("Route string could not be transduced into a payload.");
  }

  present(payload: TPayload): string {
    const { routes } = this;
    for (let i = 0, length = routes.length; i < length; i++) {
      const { presenter } = routes[i];
      const routeString = presenter && presenter(payload);
      if (routeString) return routeString;
    }

    throw Error("Route payload could not be presented as string.");
  }

  handle(
    payload: TPayload,
    origin: TPayload | null,
    redirections: TPayload[]
  ): Promise<void> {
    const { routes } = this;
    for (let i = 0, length = routes.length; i < length; i++) {
      const { handler } = routes[i];
      if (!handler) continue;
      const helpers = {
        origin,
        redirections,
        redirect: (payload: TPayload) =>
          this._redirect(payload, origin, redirections),
        replace: (target: TPayload) => this._replace(target),
        handleCancel: (cancelHandler: () => any) =>
          this._cancelHandlers.push(cancelHandler)
      };
      const result = handler(payload, helpers);
      if (result !== false)
        return result instanceof Promise ? result : Promise.resolve();
    }
    throw Error("Route payload was not handled.");
  }

  onDefer(callback: () => any) {
    this._deferCallbacks.push(callback);
  }

  onPayloadChange(callback: () => any) {
    this._payloadChangeCallbacks.push(callback);
  }

  onCancel(callback: () => any) {
    this._cancelCallbacks.push(callback);
  }

  get status() {
    return this._getState().routingState;
  }

  get payload() {
    return <TPayload>this._getState().currentPayload;
  }

  get routeString() {
    return this.present(this.payload);
  }

  get nextPayload() {
    return this._getState().nextPayload;
  }

  get routes() {
    return flatten(this.settings.routes);
  }

  private _tryDeferNavigation(payload: TPayload) {
    this._origin = this._state.currentPayload;
    this._setState({
      nextPayload: payload,
      routingState: RoutingState.deferred
    });
    const { deferer } = this.settings;
    const deferResult = deferer ? deferer(payload) : true;
    const handleCanceledDefer = () => {
      const cancelHandler = [...this._cancelHandlers];
      this._cancelHandlers = [];
      this._promise = null;
      this._setState({
        routingState: RoutingState.resting,
        nextPayload: null
      });
      cancelHandler.forEach(handler => handler());
      this._cancelCallbacks.forEach(callback => callback());
    };

    const handleResult = (result: boolean) => {
      if (result) {
        this._activateNavigation(<TPayload>this._state.nextPayload);
      } else {
        handleCanceledDefer();
      }
    };

    if (deferResult instanceof Promise) {
      const promise = deferResult.then(result => {
        if (this._promise === promise) handleResult(result);
      });
      this._promise = promise;
      this._deferCallbacks.forEach(callback => callback());
    } else handleResult(deferResult);
  }

  private _activateNavigation(payload: TPayload) {
    const lastPayload = this._state.currentPayload;
    this._promise = null;
    this._setState({
      nextPayload: null,
      currentPayload: payload,
      routingState: RoutingState.active
    });

    this._payloadChangeCallbacks.forEach(callback => callback());
    const result = this.handle(payload, lastPayload, []);
    if (result instanceof Promise) {
      this._promise = result.then(() => {
        this._setState({ routingState: RoutingState.resting });
        this._promise = null;
      });
      return result;
    }
    this._setState({ routingState: RoutingState.resting });
    return Promise.resolve();
  }

  private _redirect(
    payload: TPayload,
    origin: TPayload | null,
    redirections: TPayload[]
  ) {
    this._replace(payload);
    return Promise.resolve(
      this.handle(payload, origin, [
        ...redirections,
        <TPayload>this._state.currentPayload
      ])
    );
  }

  private _replace(payload: TPayload) {
    this._setState({ ...this._state, currentPayload: payload });
    this._payloadChangeCallbacks.forEach(callback => callback());
  }

  private _setState(state: Partial<RouterState<TPayload>>) {
    const { stateThunks } = this.settings;
    const newState = { ...this._state, ...state };
    const next = () => (this._state = newState);
    ((stateThunks && stateThunks.setState) || <any>defaultThunk)(
      next,
      newState
    );
  }

  private _getState(): RouterState<TPayload> {
    const { stateThunks } = this.settings;
    const next = () => this._state;
    return ((stateThunks && stateThunks.getState) || <any>defaultThunk)(next);
  }
}

export function transduceRegex<TPayload>(
  regex: RegExp,
  result: (...matches: string[]) => TPayload
): RouteTransducer<TPayload> {
  return hash => {
    const matches = regex.exec(hash);
    if (!matches) return null;
    return result(...matches);
  };
}

function flatten<T>(array: RecursiveArray<T>): T[] {
  let newArr = [] as T[];
  array.forEach(a => {
    if (Array.isArray(a)) {
      newArr = newArr.concat(flatten(a));
    } else {
      newArr.splice(newArr.length, 0, a);
    }
  });
  return newArr;
}
