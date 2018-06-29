/* exported getListRules, getRuleById, createRule, deleteRule, updateRule */

const storage = browser.storage.local;

class Rule {

    constructor(
        public title?: string,
        public hostField?: string,
        public sources?: string[],
        public interval = 2,
        public id = Math.random().toString(36).substr(2),
        public created = new Date(),
        public modified = new Date(),
        public inlinecss = true,
        public inlinejs = true,
    ) { }

}

async function getListRules(): Promise<Rule[]> {
    try {
        const result = await storage.get("rules");
        if (result.rules instanceof Array) {
            return result.rules.filter((r) => r instanceof Object).map((r) => {
                return new Rule(
                    r.id,
                    r.title,
                    r.created,
                    r.modified,
                    r.sources
                );
            });
        }
    } catch (error) {
        console.error(error);
        throw new Error(`Error getting: ${error.message}`);
    }
    return [];
}

async function getRuleById(ruleId): Promise<Rule> {
    const rules = await getListRules();
    const rule = rules.find((r) => r.id === ruleId);
    if (rule) {
        return rule;
    } else {
        console.error(`Not found: ${rule.id}`, rules);
        throw new Error(`No such rule: ${rule.id}`);
    }
}

async function createRule(rule) {
    const rules = await getListRules();
    rules.push(rule);
    return saveAllRules(rules);
}

async function deleteRule(deleteId) {
    const rules = await getListRules();
    const index = rules.findIndex((rule) => rule.id === deleteId);
    if (index === -1) {
        // Already deleted?
        console.error(`Not found: ${deleteId}`, rules);
    }
    rules.splice(index, 1);
    return saveAllRules(rules);
}

async function updateRule(updateId, rule) {
    const rules = await getListRules();
    const index = rules.findIndex((r) => r.id === updateId);
    if (index === -1) {
        console.error(`Not found: ${rule.id}`, rules);
        throw new Error(`Cannot find rule with id ${rule.id} to update`);
    }
    rules[index] = rule;
    return saveAllRules(rules);
}

async function saveAllRules(rules) {
    rules.forEach((rule) => {
        if (!rule || typeof rule !== "object") {
            console.error("Corrupt:", rule);
            throw new Error(`Attempting to store corrupt data: ${rule}`);
        }
    });
    try {
        await storage.set({ rules });
        return rules;
    } catch (error) {
        console.error("Error saving:", error);
        throw new Error(`Error saving rules: ${error.message}`);
    }
}
