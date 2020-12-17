
/*
This file only has TypeScript types for tags.
Often you need a way to identify things, 
like a entity and a collision part.
These tags are a way to make that typesafe.

Whenever you need to define a new one, add it to one of 
these lists.

It is a bit tedious to have to add one here each time,
but it adds auto-complete and type safety. 


*/


const entityTags = [
    "Player",


    
] as const;

export type EntityTag = typeof entityTags[number];




