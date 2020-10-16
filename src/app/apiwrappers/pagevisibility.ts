

// Very simple api, only three things. 
// visibilitychange event, 
// doc.hidden property,
//  and doc.visibilityState property

document.addEventListener("visibilitychange", (e) => {
    // The event doesn't have any special info
    // Document.hidden === true if page is hidden

    console.log(document.visibilityState)
    // either 'visible' or 'hidden'
}, false);