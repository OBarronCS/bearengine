

const stopDefault = (e: DragEvent) => {
    e.stopPropagation();
    e.preventDefault();
}

// These are NOT complete --> just the stuff that I need since Typescript doesn't have them by default
interface Entry {
    fullPath: string,
    isFile: boolean,
    isDirectory: boolean,
    name:string,
}

interface FileEntry extends Entry {
    file(func: (file: File) => void, error: (error: Error) => void): void
}

interface DirectoryEntry extends Entry {
    createReader(): DirectoryReader
}

interface DirectoryReader {
    readEntries(callback: (fileEntries: FileEntry[]) => void,  error: (error: Error) => void): void
}

/**
 * @description Handles drop and drop capabilities for a target DOM element
 */
export class DropTarget {

    public targetElement: HTMLElement;
    public enabled: boolean; 

    constructor(target: string);
    constructor(target: HTMLElement);

    constructor(target: string | HTMLElement){
        const targetAsString = target;
        if(typeof target === "string"){
            target = document.querySelector(target) as HTMLElement
        }

        const targetElement = target as HTMLElement;

        if(targetElement === null){
            throw Error("No DOM element found: " + targetAsString)
        }
        
        this.targetElement = targetElement;

        this.ondropFunctions = [];
        this.enabled = false;
    }

    toggle(){
        if(this.enabled){
            this.disable();
        } else {
            this.enable();
        }
    }

    // Adds event listeners
    enable(){
        if(!this.enabled){
            this.targetElement.addEventListener("dragenter",stopDefault, false);
            this.targetElement.addEventListener("dragover",stopDefault, false);
            this.targetElement.addEventListener("drop",this.drop.bind(this), false);
            this.enabled = true;
        }
    }

    disable(){
        if(this.enabled){
            this.targetElement.removeEventListener("dragenter",stopDefault, false);
            this.targetElement.removeEventListener("dragover",stopDefault, false);
            this.targetElement.removeEventListener("drop",this.drop.bind(this), false);
            this.enabled = false;
        }
    }


    private ondropFunctions: ((files: File[], originalEvent: DragEvent) => void)[];


    onDrop(callback: (files: File[], originalEvent: DragEvent) => void){
        this.ondropFunctions.push(callback);
    }

    private handleFiles(files: File[], originalEvent: DragEvent){
        // file is a 'subclass' of Blob
        
        this.ondropFunctions.forEach(func => {
            func(files, originalEvent);
        })
    }


    private async drop(e: DragEvent){
        stopDefault(e);

        // WARNING chrome debugging tools don't show any files unless you specfically get dataTransfer.files
        // has to do with different read/write mode of the thing...
        const dt = e.dataTransfer;

        //Some browsers don't support dropping folders,
        //So there are two api's to support drag and drop

        //Does NOT support folder --> FileList
        //const files = getFilesFromFileList(dt.files)

        // This supports folder, uses DataTransferItemList
        const files = await getItemListFiles(dt.items);

        console.log(files)


        this.handleFiles(files, e);
    }
}

// Wrapping File and Directory API With promises
async function getFileFromFileEntry(fileEntry: FileEntry): Promise<File> { 
    try {
        return await new Promise((resolve, reject) => fileEntry.file(resolve,reject));
    } catch (err) {
        // If promise is rejected, this is called 
        console.log(err, "Error while getting file")
    } finally {
        return null;
    }
}

async function getDirectoryReaderEntries(directoryReader: DirectoryReader): Promise<FileEntry[]> {
    try {
        return await new Promise((resolve, reject) => directoryReader.readEntries(resolve,reject));
    } catch (err) {
        console.log(err, "Directory scan failed");
    } finally {
        return null;
    }
}

/**
     * @description Recursively reads the directory returns a list of files
     * @param directory 
*/
async function scanDirectory(directory: DirectoryEntry){
    const files: File[] = [];
    const directoryReader = directory.createReader();

    //Can only readEntries ONCE
    const entries = await getDirectoryReaderEntries(directoryReader);
    for(const entry of entries){
        if(entry === null) continue;
        if(entry.isFile){
            const actualFile = await getFileFromFileEntry(entry);
            files.push(actualFile);
        } else if(entry.isDirectory) {
            const more_files = await scanDirectory(entry as any as DirectoryEntry);
            files.push(...more_files)
        }
    }

    return files;
}

async function getItemListFiles(itemList: DataTransferItemList): Promise<File[]>{
    const files: File[] = [];
    
    // Something ASYNC was clearing the itemList, so here I am copying it so it can persist
    // issue seen here before : https://stackoverflow.com/questions/55658851/javascript-datatransfer-items-not-persisting-through-async-calls
    // So have to add them all to a list first :)
    const list: Entry[] = [];
    for (let i = 0; i < itemList.length; i++){
        const dataTransferItem = itemList[i];
        const entry = dataTransferItem.webkitGetAsEntry() as Entry;
        list.push(entry);
    }

    for (let i = 0; i < list.length; i++){
        const entry = list[i];

        // In some situations, this is null (when you drag something not a file or folder)
        // If one null, most likely all null though.
        if(entry === null) { 
            console.log("Invalid thing dropped")
            continue; 
        }


        if(entry.isFile){
            const fileEntry = entry as FileEntry;

            const actualFile = await getFileFromFileEntry(fileEntry);
            files.push(actualFile);

        } else if (entry.isDirectory){
            const directory = entry as DirectoryEntry;

            const more_files = await scanDirectory(directory);
            files.push(...more_files);
        }
    }

    return files;
}


// Use this if folders are not supported.
function getFilesFromFileList(fileList: FileList){    
    const files: File[] = []

    for(let i = 0; i < fileList.length; i++){
        const file = fileList[i];
        files.push(file);
    }

    return files
}


// CLIPBOARD STUFF

// /*
// https://web.dev/progressively-enhance-your-pwa/
// */

// // COPY AND PASTE --> NOT WORKING REALLY WELL AS OF NOW
// // Cannot copy paste as file 
// // DOCS ARE NOT CORRECT --> MAYBE IN A COUPLE YEARS IT"LL BE BETTER
// // https://web.dev/async-clipboard/#feature-detection
// document.onpaste = function(){
//     // TypeScript is not on the cutting edge --> doesnt have type definition for these
//     // @ts-ignore
//     navigator.clipboard.read().then(data => {
//         // the docs are all over about what this returns
//         // some say its a datatransfer objects
//         // devtools just says its an array of clipboarditems
//         console.log(data)
//         for (const item of data) {

//                 for (const type of item.types) {
//                     item.getType(type).then(blob => {
//                         console.log(blob);
//                     })
//                 }
    
//         }

//     })
// }

