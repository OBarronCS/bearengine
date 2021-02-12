
/*
Often you need a way to identify things, 
like a entity or a collision part.
These tags are a way to make that typesafe.

Whenever you need to define a new one, add it to one of 
these lists.

It is tedious to have to add one here each time,
but it adds auto-complete and type safety. 
*/

// not in use right now
const entityTags = [
    "Player",


    
] as const;

export type EntityTag = typeof entityTags[number];




