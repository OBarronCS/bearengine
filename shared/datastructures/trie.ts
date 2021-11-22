


class Node {
    
    constructor(public char: string){}

    isLeaf(){
        return this.children.size === 0;
    }

    children = new Map<string, Node>();
}


// Case sensitive 
export class Trie {

    root = new Node(null);

    insert(insert_word: string): this {

        const word = insert_word.trim();

        let current_node = this.root;
        
        for(let i = 0; i < word.length; i++){
            if(!current_node.children.has(word[i])){
                current_node.children.set(word[i], new Node(word[i]))
            } 

            current_node = current_node.children.get(word[i]);
        }

        return this;
    }

    insertAll(iter: Iterable<string>): this {
        for(const i of iter){
            this.insert(i);
        }

        return this;
    }

    // // Adds full word to list if need be
    private getAllSubOptions(currentNode: Node, stringSoFar: string, list: string[]): void {
        for(const [char, node] of currentNode.children){
            if(node.isLeaf()){
                list.push(stringSoFar + node.char);
            } else {
                this.getAllSubOptions(node, stringSoFar + node.char, list);
            }
        }
    }

    /** Returns list of possible strings to finish with */
    autocomplete(search_word: string): string[] {


        const partialWord = search_word.trim();

        // Get to the point where we need more letters
        // When hit branch, go here
        let current_node = this.root;
        
        for(let i = 0; i < partialWord.length; i++){
            if(!current_node.children.has(partialWord[i])){
                break;
            } 

            current_node = current_node.children.get(partialWord[i]);
        }

        //Nothing to suggest
        if(current_node.isLeaf()) return [];

        const options: string[] = [];
        this.getAllSubOptions(current_node, "", options)


        return options;
    }


    // toString(): string {
    //     // return this.root;
    // }

}






