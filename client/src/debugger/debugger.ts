
// This script is contained in the pop-up debugger page;
// Responsible for drawing that debug content and click 

const item = {
    name: {
        name: "billy"
    }
} 



//@ts-ignore
window.test = function(){
    console.log(JSON.stringify(item))
}

//@ts-ignore
window.BOB = class GlobalTest {

    static get cheese(){
        return item;
    }
}




