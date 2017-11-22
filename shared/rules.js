/* exported getListRules, getRuleById, createRule, updateRule */


async function getListRules() {
    // Fetch reload rules from storage.
    try {
        const result = await browser.storage.sync.get('rules');
        if (result.rules instanceof Array) {
            return result.rules;
        }
    } catch (error) {
        console.error(error);
        throw new Error(`Error getting: ${error.message}`);
    }
    return [];
}


async function getRuleById(ruleId) {
    const rules = await getListRules();
    const rule = rules.find((rule) => rule.id === ruleId);
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
    return await saveAllRules(rules);
}


async function updateRule(updateId, rule) {
    const rules = await getListRules();
    const index = rules.findIndex((rule) => rule.id === updateId);
    if (index === -1) {
        console.error(`Not found: ${rule.id}`, rules);
        throw new Error(`Cannot find rule with id ${rule.id} to update`);
    }
    rules[index] = rule;
    return await saveAllRules(rules);
}


async function saveAllRules(rules) {
    rules.forEach((rule) => {
        if (!rule || typeof rule !== 'object') {
            console.error('Corrupt:', rule);
            throw new Error(`Attempting to store corrupt data: ${rule}`);
        }
    });
    try {
        await browser.storage.sync.set({rules});
        return rules;
    } catch (error) {
        console.error('Error saving:', error);
        throw new Error(`Error saving rules: ${error.message}`);
    }
}
