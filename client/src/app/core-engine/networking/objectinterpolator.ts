import { PartQuery } from "shared/core/partquery";
import { RemoteLocations } from "./remotecontrol";
import { BufferedNetwork } from "./socket";



export class NetworkObjectInterpolator {

    private objects: RemoteLocations[] = [];

    public partQuery = new PartQuery(RemoteLocations, e => {
        this.add(e)
    }, e => {
        this.remove(e)
    });

    private network: BufferedNetwork;

    constructor(network: BufferedNetwork){
        this.network = network;
    }

    update(){
        const frame = this.network.tickToSimulate();

        for(const obj of this.objects){
            obj.setPosition(frame)
        }
    }

    add(c: RemoteLocations){
        this.objects.push(c);
    }

    remove(c: RemoteLocations){
        const i = this.objects.indexOf(c);
        if(i !== -1){
            this.objects.splice(i,1);
        }
    }
}







