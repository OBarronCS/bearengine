


// WARNING --> This MUST be called as a result of some user action, else it will always fail
// on CHROME --> escape will always leave fullscreen. hold escape if escape key is locked.

export function StartFullscreen(doc: Document, target: Element){
    if(doc.fullscreenEnabled){
        target.requestFullscreen();
    }
    // doc or element events --- works on both:
    // Document.onfullscreenchange
    // Document.onfullscreenerror
    
    //DocumentOrShadowRoot.fullscreenElement
    // --> null if not in fullscreen, or the fullscreen element otherwie

    // exitPromise = document.exitFullscreen();
}

/*
function toggleFullscreen() {
  let elem = document.querySelector("video");

  if (!document.fullscreenElement) {
    elem.requestFullscreen().catch(err => {
      alert(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
    });
  } else {
    document.exitFullscreen();
  }
}
 */


