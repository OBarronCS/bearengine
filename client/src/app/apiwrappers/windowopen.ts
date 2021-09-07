
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
export async function CreateWindow(settings: CreateWindowSettings): Promise<Window> {
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

    // Forces a new open to open, and for the onload event to be ran
    const targetName = "Window"+Math.random();

    const new_window = window.open("debugger.html",targetName,
        `width=${width},height=${height},left=${left},top=${top},` + additional_features
    );

    // If global window closes, close all subwindows.
    window.addEventListener("beforeunload", () => {
        new_window.close()
    });

    // Works!
    return new Promise(resolve => {
        
        new_window.addEventListener("load", () => {
            console.log("Popup window loaded")
            //@ts-expect-error
            console.log(new_window.test)
    
            //@ts-ignore
            new_window.test();
            //@ts-expect-error
            new_window.BOB.cheese.name = "sally";
            //@ts-ignore
            new_window.test();
            
            resolve(new_window)
        });
    });
}

