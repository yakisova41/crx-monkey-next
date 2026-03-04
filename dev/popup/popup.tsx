import {createRoot} from "react-dom/client";
import App from "./App";
import { StrictMode } from "react";
import { getEnv } from "../../packages/crx-monkey/dist/client/main";

const root = document.querySelector("#root")!
const reactRoot = createRoot(root)
console.log(getEnv())
reactRoot.render(
    <StrictMode>
        <App/>
    </StrictMode>
)   

