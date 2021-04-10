

// Very simple api, only three things. 
// visibilitychange event, 
// doc.hidden property --> this is old version
//  and doc.visibilityState property --> use this instead

document.addEventListener("visibilitychange", (e) => {
    // The event doesn't have any special info
    // Document.hidden === true if page is hidden

    console.log(document.visibilityState)
    // either 'visible' or 'hidden'
}, false);

