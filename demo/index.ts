import { HistoryRouter } from "../src";

interface IPage1 {
  page: "page1";
}

interface IPage2 {
  page: "page2";
  foo: string;
}

interface IPage3 {
  page: "page3";
  bar: string;
}

const contentEl = <HTMLDivElement>document.getElementById("content");
const deferEl = <HTMLDivElement>document.getElementById("defer");
const router = new HistoryRouter<IPage1 | IPage2 | IPage3>({
  transducers: [
    route => {
      const match = /^page2\/(.+)$/.exec(route);
      return match ? { page: "page2", foo: match[1] } : null;
    },
    route => {
      const match = /^page3\/(.+)$/.exec(route);
      return match ? { page: "page3", bar: match[1] } : null;
    },
    () => ({ page: "page1" })
  ],
  presenters: [
    payload =>
      payload.page === "page1"
        ? "page1"
        : payload.page === "page2"
          ? `page2/${payload.foo}`
          : payload.page === "page3"
            ? `page3/${payload.bar}`
            : null
  ],
  handlers: [
    payload => payload.page === "page2" && console.log("page2 handler"),
    payload => payload.page === "page3" && console.log("page3 handler"),
    payload => payload.page === "page1" && console.log("page1 handler")
  ],
  deferer(payload) {
    if (payload.page === "page1") return true;
    return new Promise(resolve => {
      let done: (value: boolean) => void;
      const ok = document.createElement("button");
      ok.textContent = "OK, proceed!";
      ok.onclick = () => done(true);

      const cancel = document.createElement("button");
      cancel.textContent = "Cancel navigation";
      cancel.onclick = () => done(false);
      deferEl.appendChild(ok);
      deferEl.appendChild(cancel);

      done = value => {
        deferEl.removeChild(ok);
        deferEl.removeChild(cancel);
        resolve(value);
      };
    });
  },
  stateThunks: {
    setState(next, state) {
      next();
      contentEl.textContent = JSON.stringify(state);
    }
  }
});

Object.defineProperty(window, "router", {
  value: router
});

router.start();
