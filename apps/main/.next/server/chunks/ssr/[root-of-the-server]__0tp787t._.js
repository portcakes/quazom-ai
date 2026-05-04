;!function(){try { var e="undefined"!=typeof globalThis?globalThis:"undefined"!=typeof global?global:"undefined"!=typeof window?window:"undefined"!=typeof self?self:{},n=(new e.Error).stack;n&&((e._debugIds|| (e._debugIds={}))[n]="172e1316-eef3-d223-d620-8b99ea755a7e")}catch(e){}}();
module.exports=[14747,(a,b,c)=>{b.exports=a.x("path",()=>require("path"))},24361,(a,b,c)=>{b.exports=a.x("util",()=>require("util"))},78500,(a,b,c)=>{b.exports=a.x("node:async_hooks",()=>require("node:async_hooks"))},22734,(a,b,c)=>{b.exports=a.x("fs",()=>require("fs"))},62562,(a,b,c)=>{b.exports=a.x("module",()=>require("module"))},33405,(a,b,c)=>{b.exports=a.x("child_process",()=>require("child_process"))},92509,(a,b,c)=>{b.exports=a.x("url",()=>require("url"))},12860,(a,b,c)=>{b.exports=a.x("require-in-the-middle-2ca7b9c2766f317e",()=>require("require-in-the-middle-2ca7b9c2766f317e"))},58555,(a,b,c)=>{b.exports=a.x("import-in-the-middle-ac114f323ad7e863",()=>require("import-in-the-middle-ac114f323ad7e863"))},27699,(a,b,c)=>{b.exports=a.x("events",()=>require("events"))},77652,(a,b,c)=>{b.exports=a.x("node:diagnostics_channel",()=>require("node:diagnostics_channel"))},87769,(a,b,c)=>{b.exports=a.x("node:events",()=>require("node:events"))},54993,(a,b,c)=>{b.exports=a.x("diagnostics_channel",()=>require("diagnostics_channel"))},74533,(a,b,c)=>{b.exports=a.x("node:child_process",()=>require("node:child_process"))},2157,(a,b,c)=>{b.exports=a.x("node:fs",()=>require("node:fs"))},60526,(a,b,c)=>{b.exports=a.x("node:os",()=>require("node:os"))},50227,(a,b,c)=>{b.exports=a.x("node:path",()=>require("node:path"))},12057,(a,b,c)=>{b.exports=a.x("node:util",()=>require("node:util"))},1457,(a,b,c)=>{b.exports=a.x("node:readline",()=>require("node:readline"))},25127,(a,b,c)=>{b.exports=a.x("node:worker_threads",()=>require("node:worker_threads"))},37702,(a,b,c)=>{b.exports=a.x("worker_threads",()=>require("worker_threads"))},47299,(a,b,c)=>{b.exports=a.x("node:http",()=>require("node:http"))},43698,(a,b,c)=>{b.exports=a.x("node:https",()=>require("node:https"))},81111,(a,b,c)=>{b.exports=a.x("node:stream",()=>require("node:stream"))},27028,(a,b,c)=>{b.exports=a.x("node:zlib",()=>require("node:zlib"))},61095,(a,b,c)=>{b.exports=a.x("node:net",()=>require("node:net"))},85560,(a,b,c)=>{b.exports=a.x("node:tls",()=>require("node:tls"))},60438,(a,b,c)=>{b.exports=a.x("perf_hooks",()=>require("perf_hooks"))},88396,(a,b,c)=>{b.exports=a.x("import-in-the-middle-8c7f9689dc1aad0b",()=>require("import-in-the-middle-8c7f9689dc1aad0b"))},92170,(a,b,c)=>{b.exports=a.x("import-in-the-middle-ed27ddb9d78573fe",()=>require("import-in-the-middle-ed27ddb9d78573fe"))},23700,(a,b,c)=>{"use strict";function d(){return null}Object.defineProperty(c,"__esModule",{value:!0}),Object.defineProperty(c,"default",{enumerable:!0,get:function(){return d}}),("function"==typeof c.default||"object"==typeof c.default&&null!==c.default)&&void 0===c.default.__esModule&&(Object.defineProperty(c.default,"__esModule",{value:!0}),Object.assign(c.default,c),b.exports=c.default)},25107,a=>{"use strict";var b=a.i(87924),c=a.i(18808),d=a.i(23700),e=a.i(72131);class f extends Error{constructor(a){super(a),this.name="SentryExampleFrontendError"}}a.s(["default",0,function(){let[a,g]=(0,e.useState)(!1),[h,i]=(0,e.useState)(!0);return(0,e.useEffect)(()=>{c.logger.info("Sentry example page loaded"),async function(){i("sentry-unreachable"!==await c.diagnoseSdkConnectivity())}()},[]),(0,b.jsxs)("div",{children:[(0,b.jsxs)(d.default,{children:[(0,b.jsx)("title",{children:"sentry-example-page"}),(0,b.jsx)("meta",{name:"description",content:"Test Sentry for your Next.js app!"})]}),(0,b.jsxs)("main",{children:[(0,b.jsx)("div",{className:"flex-spacer"}),(0,b.jsx)("svg",{height:"40",width:"40",fill:"none",xmlns:"http://www.w3.org/2000/svg",role:"img","aria-label":"Sentry logo",children:(0,b.jsx)("path",{d:"M21.85 2.995a3.698 3.698 0 0 1 1.353 1.354l16.303 28.278a3.703 3.703 0 0 1-1.354 5.053 3.694 3.694 0 0 1-1.848.496h-3.828a31.149 31.149 0 0 0 0-3.09h3.815a.61.61 0 0 0 .537-.917L20.523 5.893a.61.61 0 0 0-1.057 0l-3.739 6.494a28.948 28.948 0 0 1 9.63 10.453 28.988 28.988 0 0 1 3.499 13.78v1.542h-9.852v-1.544a19.106 19.106 0 0 0-2.182-8.85 19.08 19.08 0 0 0-6.032-6.829l-1.85 3.208a15.377 15.377 0 0 1 6.382 12.484v1.542H3.696A3.694 3.694 0 0 1 0 34.473c0-.648.17-1.286.494-1.849l2.33-4.074a8.562 8.562 0 0 1 2.689 1.536L3.158 34.17a.611.611 0 0 0 .538.917h8.448a12.481 12.481 0 0 0-6.037-9.09l-1.344-.772 4.908-8.545 1.344.77a22.16 22.16 0 0 1 7.705 7.444 22.193 22.193 0 0 1 3.316 10.193h3.699a25.892 25.892 0 0 0-3.811-12.033 25.856 25.856 0 0 0-9.046-8.796l-1.344-.772 5.269-9.136a3.698 3.698 0 0 1 3.2-1.849c.648 0 1.285.17 1.847.495Z",fill:"currentcolor"})}),(0,b.jsx)("h1",{children:"sentry-example-page"}),(0,b.jsxs)("p",{className:"description",children:["Click the button below, and view the sample error on the Sentry"," ",(0,b.jsx)("a",{target:"_blank",rel:"noopener",href:"https://ediox-edtech.sentry.io/issues/?project=4511326591320064",children:"Issues Page"}),". For more details about setting up Sentry,"," ",(0,b.jsx)("a",{target:"_blank",rel:"noopener",href:"https://docs.sentry.io/platforms/javascript/guides/nextjs/",children:"read our docs"}),"."]}),(0,b.jsx)("button",{type:"button",onClick:async()=>{throw c.logger.info("User clicked the button, throwing a sample error"),await c.startSpan({name:"Example Frontend/Backend Span",op:"test"},async()=>{(await fetch("/api/sentry-example-api")).ok||g(!0)}),new f("This error is raised on the frontend of the example page.")},disabled:!h,children:(0,b.jsx)("span",{children:"Throw Sample Error"})}),a?(0,b.jsx)("p",{className:"success",children:"Error sent to Sentry."}):h?(0,b.jsx)("div",{className:"success_placeholder"}):(0,b.jsx)("div",{className:"connectivity-error",children:(0,b.jsx)("p",{children:"It looks like network requests to Sentry are being blocked, which will prevent errors from being captured. Try disabling your ad-blocker to complete the test."})}),(0,b.jsx)("div",{className:"flex-spacer"})]}),(0,b.jsx)("style",{children:`
        main {
          display: flex;
          min-height: 100vh;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          gap: 16px;
          padding: 16px;
          font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
        }

        h1 {
          padding: 0px 4px;
          border-radius: 4px;
          background-color: rgba(24, 20, 35, 0.03);
          font-family: monospace;
          font-size: 20px;
          line-height: 1.2;
        }

        p {
          margin: 0;
          font-size: 20px;
        }

        a {
          color: #6341F0;
          text-decoration: underline;
          cursor: pointer;

          @media (prefers-color-scheme: dark) {
            color: #B3A1FF;
          }
        }

        button {
          border-radius: 8px;
          color: white;
          cursor: pointer;
          background-color: #553DB8;
          border: none;
          padding: 0;
          margin-top: 4px;

          & > span {
            display: inline-block;
            padding: 12px 16px;
            border-radius: inherit;
            font-size: 20px;
            font-weight: bold;
            line-height: 1;
            background-color: #7553FF;
            border: 1px solid #553DB8;
            transform: translateY(-4px);
          }

          &:hover > span {
            transform: translateY(-8px);
          }

          &:active > span {
            transform: translateY(0);
          }

          &:disabled {
	            cursor: not-allowed;
	            opacity: 0.6;

	            & > span {
	              transform: translateY(0);
	              border: none
	            }
	          }
        }

        .description {
          text-align: center;
          color: #6E6C75;
          max-width: 500px;
          line-height: 1.5;
          font-size: 20px;

          @media (prefers-color-scheme: dark) {
            color: #A49FB5;
          }
        }

        .flex-spacer {
          flex: 1;
        }

        .success {
          padding: 12px 16px;
          border-radius: 8px;
          font-size: 20px;
          line-height: 1;
          background-color: #00F261;
          border: 1px solid #00BF4D;
          color: #181423;
        }

        .success_placeholder {
          height: 46px;
        }

        .connectivity-error {
          padding: 12px 16px;
          background-color: #E50045;
          border-radius: 8px;
          width: 500px;
          color: #FFFFFF;
          border: 1px solid #A80033;
          text-align: center;
          margin: 0;
        }

        .connectivity-error a {
          color: #FFFFFF;
          text-decoration: underline;
        }
      `})]})}])},34177,a=>{a.v(b=>Promise.all(["server/chunks/ssr/[externals]_node_inspector_0l06k~z._.js"].map(b=>a.l(b))).then(()=>b(37221)))}];

//# debugId=172e1316-eef3-d223-d620-8b99ea755a7e
//# sourceMappingURL=%5Broot-of-the-server%5D__0tp787t._.js.map