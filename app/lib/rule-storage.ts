// const storage = browser.storage.local;

// async function getListRules(): Promise<Rule[]> {
//     try {
//         const result = await storage.get("rules");
//         if (result.rules instanceof Array) {
//             return result.rules.filter((r) => r instanceof Object).map((r) => {
//                 return Rule.fromStorage(r);
//             });
//         }
//     } catch (error) {
//         console.error(error);
//         throw new Error(`Error getting: ${error.message}`);
//     }
//     return [];
// }

// async function getRuleById(ruleId: string): Promise<Rule> {
//     const rules = await getListRules();
//     const rule = rules.find((r) => r.id === ruleId);
//     if (rule) {
//         return rule;
//     } else {
//         console.error(`Not found: ${rule.id}`, rules);
//         throw new Error(`No such rule: ${rule.id}`);
//     }
// }

// // async function createRule(rule: Rule): Promise<Rule[]> {
// //     const rules = await getListRules();
// //     rules.push(rule);
// //     return saveAllRules(rules);
// // }

// async function deleteRule(deleteId): Promise<boolean> {
//     const rules = await getListRules();
//     const index = rules.findIndex((rule) => rule.id === deleteId);
//     if (index === -1) {
//         // Already deleted?
//         console.error(`Not found: ${deleteId}`, rules);
//     }
//     rules.splice(index, 1);
//     await saveAllRules(rules);
//     return true;
// }

// async function updateRule(updateId: string, rule: Rule): Promise<Rule> {
//     const rules = await getListRules();
//     const index = rules.findIndex((r) => r.id === updateId);
//     if (index === -1) {
//         console.error(`Not found: ${rule.id}`, rules);
//         throw new Error(`Cannot find rule with id ${rule.id} to update`);
//     }
//     rules[index] = rule;
//     await saveAllRules(rules);
//     return rule;
// }

// async function saveAllRules(rules: Rule[]): Promise<Rule[]> {
//     rules.forEach((rule) => {
//         if (!rule || typeof rule !== "object") {
//             console.error("Corrupt:", rule);
//             throw new Error(`Attempting to store corrupt data: ${rule}`);
//         }
//     });
//     try {
//         await storage.set({ rules });
//         return rules;
//     } catch (error) {
//         console.error("Error saving:", error);
//         throw new Error(`Error saving rules: ${error.message}`);
//     }
// }

// export {
//     getListRules,
//     getRuleById,
//     // createRule,
//     deleteRule,
//     updateRule
// };
