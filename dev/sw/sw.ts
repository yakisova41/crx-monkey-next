console.log("service worker running")

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log("Message recieved.", message)

    sendResponse({
        message: "Response from sw"
      })
    
    if(sender.tab?.id !== undefined) {
       chrome.tabs.sendMessage(sender.tab?.id, {
        message: "Hello from sw"
      }); 
    }
    
})