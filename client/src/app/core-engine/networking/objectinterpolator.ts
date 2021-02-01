
import { RemoteLocations } from "./remotecontrol";
import { BufferedNetwork } from "./socket";
import { Subsystem } from "shared/core/subsystem";


export class NetworkObjectInterpolator extends Subsystem {

    public remotelocations = this.addQuery(RemoteLocations)

    private network: BufferedNetwork;

    constructor(network: BufferedNetwork){
        super();
        this.network = network;
    }

    update(){
        const frame = this.network.tickToSimulate();

        for(const obj of this.remotelocations.parts){
            obj.setPosition(frame)
        }
    }
}







