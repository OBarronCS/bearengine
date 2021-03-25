import { AssertUnreachable } from "shared/assertstatements";
import { AbstractBearEngine } from "shared/core/abstractengine";
import { AbstractEntity } from "shared/core/abstractentity";
import { Scene } from "shared/core/scene";
import { RemoteFunction, RemoteFunctionLinker } from "shared/core/sharedlogic/networkedentitydefinitions";
import { GamePacket } from "shared/core/sharedlogic/packetdefinitions";
import { Subsystem } from "shared/core/subsystem";
import { TerrainManager } from "shared/core/terrainmanager";
import { SharedEntityClientTable } from "./cliententitydecorators";
import { RemoteEntity, RemoteLocations, SimpleNetworkedSprite } from "./remotecontrol";
import { BufferedNetwork } from "./socket";



/** Reads packets from network, applies them */
export class NetworkReadSystem extends Subsystem {

    private network: BufferedNetwork;

    public remotelocations = this.addQuery(RemoteLocations);

    // contains networked entities
    private entities: Map<number, RemoteEntity> = new Map(); 

    constructor(engine: AbstractBearEngine, network: BufferedNetwork){
        super(engine);
        this.network = network;
    }

    private getEntity<T extends AbstractEntity = AbstractEntity>(id: number): T {
        return this.entities.get(id) as any as T;
    }

    private scene: Scene;

    private remoteFunctionCallMap = new Map<keyof RemoteFunction,keyof NetworkReadSystem>()

    init(): void {

        SharedEntityClientTable.init();


        // Init remote function call linking



        let remotefunctiondata = NetworkReadSystem["REMOTE_FUNCTION_REGISTRY"] as RemoteFunctionListType;
        if(remotefunctiondata === undefined) { 
            console.log("No remote functions defined")
            remotefunctiondata = [];
        }
        // Could do this conversion directly in the decorator, and just make this an index in array not a map
        for(const remotefunction of remotefunctiondata){
            this.remoteFunctionCallMap.set(remotefunction.remoteFunctionName, remotefunction.methodName)
        }
    
        // use: this.remoteFunctionCallMap.get(RemoteFunctionLinker.getStringFromId(stream.getUint8()));

        this.scene = this.getSystem(Scene);
    }
    
    // Read from network, apply packets 
    update(delta: number): void {
        if(this.network.CONNECTED){

            const packets = this.network.newPacketQueue();

            while(!packets.isEmpty()){

                const packet = packets.dequeue();
                const frame = packet.id;
                const stream = packet.buffer;

                while(stream.hasMoreData()){
                    const type: GamePacket = stream.getUint8();

                    switch(type){
                        case GamePacket.REMOTE_ENTITY_CREATE: {
                            const sharedClassID = stream.getUint8();
                            const entityID = stream.getUint16();
                            
                            const _class = SharedEntityClientTable.getEntityClass(sharedClassID);

                            //@ts-expect-error
                            const e = new _class();

                            // Adds it to the scene
                            this.entities.set(entityID, e);
                            this.scene.addEntity(e);

                            break;
                        }

                        case GamePacket.REMOTE_ENTITY_VARIABLE_CHANGE:{
                            // [entity id, ...variables]
 
                            const eId = stream.getUint16();
                            const e = this.entities.get(eId);

                            if(e === undefined){
                                console.log("CANNOT FIND ENTITY WITH THAT VARIABLE. WILL QUIT");
                                // Idk how else to deal with this error, than to quit.
                                return;
                            }

                            SharedEntityClientTable.deserialize(e, stream);

                            break;
                        }
                        
                        case GamePacket.REMOTE_FUNCTION_CALL:{
                            const functionID = stream.getUint8();
                            const functionName = RemoteFunctionLinker.getStringFromID(functionID)

                            const methodOfThisObject = this.remoteFunctionCallMap.get(functionName);

                            RemoteFunctionLinker.callRemoteFunction(functionName, stream, this, methodOfThisObject);
                            
                            break;
                        }

                        case GamePacket.ENTITY_DESTROY:{
                             // Find correct entity
                            const id = stream.getUint16();

                            let e = this.entities.get(id);
                            if(e !== undefined){
                                console.log("Destroying entity: " + id);

                                this.scene.destroyEntity(e);
                            }
                            break;
                        }

                        case GamePacket.PLAYER_POSITION:{
                            
                            // Find correct entity
                            const id = stream.getUint16();
                            //  console.log("ID: " + id)
                            let e = this.entities.get(id);
                            if(e === undefined){
                                console.log("creating new server player entity");
                                // e should be an instance of this
                                e = new SimpleNetworkedSprite();
                                this.entities.set(id, e);
                                this.scene.addEntity(e);
                            }

                            const x = stream.getFloat32();
                            const y = stream.getFloat32();

                            (e as SimpleNetworkedSprite).locations.addPosition(frame, x,y);
                            
                            break;
                        }
                        case GamePacket.SIMPLE_POSITION:{
                            // Find correct entity
                            const id = stream.getUint16();
                            //  console.log("ID: " + id)
                            let e = this.entities.get(id);
                            if(e === undefined){
                                console.log("creating new server entity");
                                // e should be an instance of this
                                e = new SimpleNetworkedSprite()
                                this.entities.set(id, e);
                                this.scene.addEntity(e);
                            }
                            
                            (e as SimpleNetworkedSprite).locations.addPosition(frame, stream.getFloat32(), stream.getFloat32());
                            break;
                        }
                        case GamePacket.PASSTHROUGH_TERRAIN_CARVE_CIRCLE: {
                            const terrain = this.getSystem(TerrainManager);
                            const x = stream.getFloat64();
                            const y = stream.getFloat64();
                            const r = stream.getInt32();
                            terrain.carveCircle(x, y, r);
                            
                            break;
                        }
                        default: AssertUnreachable(type);
                    }
                }
                
            }

            // Interpolation of entities
            const frameToSimulate = this.network.tickToSimulate();

            for(const obj of this.remotelocations){
                obj.setPosition(frameToSimulate)
            }
        }
    }

    @remotefunction("test1")
    test(name: number, food: number){
        console.log(`REMOTE FUNCTION CALLED -> Name is ${name}, food is ${food}`);
    }
}




/** Remote Function Logic */

type RemoteFunctionListType = {
    remoteFunctionName: keyof RemoteFunction,
    methodName: keyof NetworkReadSystem,
}[]

// Event registering with decorators
function remotefunction<T extends keyof RemoteFunction>(functionName: T) {


    return function(target: NetworkReadSystem, propertyKey: keyof NetworkReadSystem /* MethodsOfClass<ClassType> */, descriptor: TypedPropertyDescriptor<RemoteFunction[T]>){
        // target is the prototype of the class
        // Now I can use this propertyKey to attach the event handler

        const constructorClass = target.constructor;
        
        if(constructorClass["REMOTE_FUNCTION_REGISTRY"] === undefined){
            constructorClass["REMOTE_FUNCTION_REGISTRY"] = [];
        }

        const remotefunctionlist = constructorClass["REMOTE_FUNCTION_REGISTRY"] as RemoteFunctionListType;
        remotefunctionlist.push({
            remoteFunctionName: functionName,
            methodName: propertyKey,
        });

        console.log(`Added remote function callback, ${functionName}, linked to method with name ${propertyKey}`)
        //console.log(target.constructor)
    }
}









