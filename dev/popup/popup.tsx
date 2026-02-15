import {createRoot} from "react-dom/client";
import App from "./App";
import { StrictMode } from "react";

const root = document.querySelector("#root")!
const reactRoot = createRoot(root)

reactRoot.render(
    <StrictMode>
        <App/>
    </StrictMode>
)   

