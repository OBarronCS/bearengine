
interface CreateWindowSettings {
    width?:number,
    height?:number,
    left?:number,
    top?:number,
    center?:boolean;
    fullscreen?: boolean;
}

// if window with "targetWindowName" exists, this replaces it
// Promise resolves once the page is fully loaded
export async function CreateWindow(targetWindowName:string, settings: CreateWindowSettings): Promise<Window> {
    // this isn't reliable --> screen.availHeight is just plain wrong in this case
    // so takes size of current window (assuming most people browse maximized)
    const max_width = window.innerWidth;
    const max_height = window.innerHeight;

    const width = settings.fullscreen ?  max_width : settings.width;
    const height = settings.fullscreen ?  max_height : settings.height;

    const left = settings.fullscreen ? -10 : (settings.center ? max_width / 2 - width / 2  : settings.left);
    const top = settings.fullscreen ? -10 : (settings.center ?  max_height / 2 - height / 2  : settings.top);

    // all default to "no" anyways
    const additional_features = "menubar=no,toolbar=no,location=no"; // scrollbars=no, status=no

    // Url can be to an actual html page.
    const new_window = window.open("debugger.html",targetWindowName,
        `width=${width},height=${height},left=${left},top=${top},` + additional_features
    )

    new_window.document.title = "Game"

    console.log(new_window.opener);

    new_window.addEventListener("load", () => {
        console.log("LOADED")
        //@ts-ignore
        new_window.test();
    })

    // assume the global window is the main one
    window.onbeforeunload = () => {
        new_window.close()
    }

    
    //TODO --> make get an actual CSS file
    new_window.document.body.style.margin = 0 + "px";

    // For some reason, there isn't a really good way to measure when the window has loaded!
    // so, just make it this timer in hopes that it has initiliazed by then...
    
    return new Promise(resolve => setTimeout(() => {
        resolve(new_window)
    },100))
}

