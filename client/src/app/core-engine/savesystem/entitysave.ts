import { EntitySystem } from "shared/core/entitysystem";
import { Entity } from "../entity";

/*
Have to wait until the TypeScript team revisits decorators to get better typing

Serialization allows two things: 
    Entities can saved and loaded in their current state when game closed and opened
    Entities can be referred to in level editor and spawned
    

Save format for each entity is a JSON object:
{
    name: "",
    variable1: ,
    variable2: ,
}

Settings:
    By default, it saves all the properties in the entity.

    If want to exclude some, use exclude property or excludeAll. 

    TODO:
        decide whether to do include property in settings
            or do a 
            @SerializeField() decorator;

            If not a simple type, need to specify something like vec2, Parts,

                
Uses the name handed to link it:
its important that it is name, because else it will be different order when add new entities that are registered at different times

    @serializable("Ogre")
    class TestOgre extends Entity {}

Maybe --> Pass in serialize, deserialize functions;
    @serializable("Ogre", settings, serialize(){}, deserialize(){});


Think about how to save parts: 
    Do same thing as this? Serializable() but before them? Or something different, like all parts are automatically serializable
*/


interface SerializationSettings {
    exclude?: string[]
    excludeAll?: boolean;
}

const defaultSettings: Required<SerializationSettings> = {
    exclude: [],
    excludeAll: false,
}

// @SerializeField()
// Class Decorator factory
export function serializable(name: string, settings: SerializationSettings = defaultSettings) {
 
    return function<T extends typeof Entity>(constructor: T) {

        SerializableEntityLookupTable.add(name, constructor);

        // // Alphabetically sorts them keys, will deserialize in this order.
        // variableslist.sort((a,b) => a.variablename.toLowerCase().localeCompare(b.variablename.toLowerCase()));

        // {   // Debug info
        //     let allVariables = "";
        //     for(const name of variableslist) allVariables += name.variablename + ",";
        //     console.log(`Confirmed class, ${targetConstructor.name}, as client entity. Contains the following variables: ${allVariables}`);
        // }
    }
}

@serializable("Ogre")
class Test extends Entity {

    test: number;
    update(dt: number): void {
    }
}


type EntityData = {
    name:string,
    [key: string]: any,
}

export const SerializableEntityLookupTable = {

    nameToEntityMap: new Map<string,typeof Entity>(),

    add(name: string, entityConstructor: typeof Entity){

        if(this.nameToEntityMap.has(name)) throw new Error(name + " already exists has a savable entity. Name taken");
        
        entityConstructor["SERIALIZABLE_NAME"] = name;

        this.nameToEntityMap.set(name, entityConstructor);
    },

    saveScene(scene: EntitySystem<Entity>): EntityData[]{

        const entities: EntityData[] = []

        for(const entity of scene.entities){
            const name: string = entity.constructor["SERIALIZABLE_NAME"];

            if(name !== undefined){
                entities.push(this.saveEntity(entity, name));
            }
        }

        return entities;
    },

    saveEntity(entity: Entity, name: string): EntityData {
        const saveStruct: EntityData = {
            name,
        };

        for(const key in entity){
            saveStruct[key] = entity[key];
        }

        return saveStruct;
    },

    loadScene(scene: EntitySystem<Entity>, data: EntityData[]){
        for(const e of data){
            const entity = this.loadEntity(e);
            scene.addEntity(entity);
        }
    },

    loadEntity(data: EntityData): Entity {
        const entityClass = this.nameToEntityMap.get(data.name);

        //@ts-expect-error
        const e = new entityClass();

        for(const key in data){
            if(key === "name") continue;
            e[key] = data[key];
        }

        return e;
    }
} as const;

