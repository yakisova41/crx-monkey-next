import {message, getRunningRuntime} from "../../packages/crx-monkey/dist/client/main"

console.log("Content scripts is running.", "world: main")

if(getRunningRuntime() === "Extension") {
 message.sendMessage({
  "message": "Hello sw"
}, {}, (response) => {
  console.log("Response recieved." , response)
})


message.addListener((request) => {
  console.log("Message recieved." , request)
})
 
}
