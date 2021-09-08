import { CheckedResult, ErrorResult, ValidResult } from "shared/core/commands"

/**
 * Test can have multiple "assert" statements. 
 * The test will continue to run even through a failed assertion, if there are multiple assertions in a test.
 * 
 * 
Example:
    testgroup("Math", (g) => {

        // helpers.beforeEach( e => {
        // })

    
        g.test("Billy", (t) => {

            //@ts-ignore
            t.assert(1===2, "One equals one");



        });
    });
 */

interface DB {
    groups: TestGroup[]
}

const TEST_DATA_BASE: DB  = {
    groups: [],
}

export function testgroup(name: string, groupSetup: (g: TestGroup) => void): void {
    TEST_DATA_BASE.groups.push(new TestGroup(name, groupSetup));
}

export function RunTests(groupsToRun:string[] = TEST_DATA_BASE.groups.map(e => e["name"])): void {
    console.log("RUNNING TESTS");

    const groupsToRunSet = new Set(groupsToRun);

    const allLogs: (CheckedResult<string, string[]>)[] = [];

    for(const group of TEST_DATA_BASE.groups){
        if(groupsToRunSet.has(group["name"])){
            group["init"]();

            const logs = group["run"]();

            allLogs.push(...logs);

        }
    }

    for(const log of allLogs){
        if(log.success === true){
            console.log("✔️: " + log.value);
        } else {
            console.log("❌: " + log.error);
        }
        
    }

}

class TestGroup {
    
    constructor(private name: string, private groupSetup: (g: TestGroup) => void)
    {
        
    }

    private tests: SingularTest[] = [];

    private init(){
        this.groupSetup(this);
    }

    private run(): (CheckedResult<string, string[]>)[] {

        const testLogs: (CheckedResult<string, string[]>)[] = [];

        for(const test of this.tests){
            
            const result = test["run"]();

            testLogs.push(result);

        }

        return testLogs;
    }


    test(name: string, callback: (t: SingularTest) => void){
        this.tests.push(new SingularTest(name,callback));
    }
}


class SingularTest {

    constructor(private name: string, private testFunc: (t: SingularTest) => void)
    {

    }

    private success = true;
    private log: string[] = [];

    private run(): CheckedResult<string, string[]> {
        
        //The test function will alter the state of this object;
        this.testFunc(this);


        if(this.success){
            return ValidResult(this.name)
        } else {
            return ErrorResult(this.log)
        }

    }

    fail(note: string): void {
        this.success = false;
        this.log.push(note);
    }

    shouldThrow(func: () => void): void {
        try {
            
            func();
            // If func() throws, this gets called
            this.fail("Function did not throw, should have");
        } catch (error) {

        }
    }

    assertContains<T>(iter: Iterable<T>, value: T): void {
        for(const i of iter){
            if(i === value){
                return;
            }
        }

        this.fail(`${iter.toString()} does not contain ${value}`);
    }

    assert(bool: boolean, note: string = "Failed assertion, Test: [" + this.name + "]"): void {
        if(!bool){
            this.fail(note);
        }

    }
}





