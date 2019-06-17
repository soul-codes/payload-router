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
  routes: [
    {
      transducer: route => {
        const match = /^page2\/(.+)$/.exec(route);
        return match ? { page: "page2", foo: match[1] } : null;
      },
      presenter: payload =>
        payload.page === "page2" ? `page2/${payload.foo}` : null,
      handler: payload =>
        payload.page === "page2" && console.log("page2 handler")
    },
    {
      transducer: route => {
        const match = /^page3\/(.+)$/.exec(route);
        return match ? { page: "page3", bar: match[1] } : null;
      },
      presenter: payload =>
        payload.page === "page3" ? `page3/${payload.bar}` : null,
      handler: payload =>
        payload.page === "page3" && console.log("page3 handler")
    },
    {
      transducer: () => ({ page: "page1" }),
      presenter: payload => (payload.page === "page1" ? "page1" : null),
      handler: payload =>
        payload.page === "page1" && console.log("page1 handler")
    }
  ],
  deferer(payload) {
    if (payload.page === "page1" || payload.page === "page3") return true;
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
      contentEl.innerHTML = `${JSON.stringify(
        state
      )} <button type="button" id="navigate">programmatically go to page 1</button>`;
      const button = contentEl.querySelector("#navigate")!;
      button.addEventListener("click", () =>
        router.navigate({
          page: "page1"
        })
      );
    }
  }
});

Object.defineProperty(window, "router", {
  value: router
});

router.start();
