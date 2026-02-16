import {  useState } from "react"

export default function App() {
    const [count , setCount] = useState(0);

    const handleClick = () => {
        setCount(count +  1)
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