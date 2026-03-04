import {  useState } from "react"
import "./popup.css"
import { getRunningRuntime } from "../../packages/crx-monkey/dist/client/main";

export default function App() {
    
    const [count , setCount] = useState(0);

    const handleClick = () => {
        setCount(count +  1);console.log(getRunningRuntime())
    }

    return  (
    <div className="container">
        <div className="content">
        <img src="public/logo.svg" width="50px" height="50px" />
        <h1 className="title">CRX MONKEY</h1>
        <p>Count: <span className="counter">{count}</span></p>
        <button className="count-up" onClick={handleClick}>Count</button>
        </div>
    </div>
    )
}