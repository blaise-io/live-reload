import * as matchPattern from "../lib/match-pattern";

const storage = browser.storage.local;

interface IStorageRule {
    _type: StorageType;
    id: string;
    title: string;
    host: string;
    sources: string[];
    ignores: string[];
    interval: number;
    inlinecss: boolean;
    inlineframes: boolean;
    created: number;
    modified: number;
}

enum StorageType {
    Rule = 0,
}

class Rule {

    public static async query(): Promise<Rule[]> {
        const allData = await storage.get(undefined);
        const rules: Rule[] = [];

        console.debug("Storage data", allData);

        Object.entries(allData as IStorageRule[]).forEach(([_, data]) => {
            if (data._type === StorageType.Rule) {
                rules.push(Rule.fromStorage(data));
            }
        });

        console.debug("Rules", rules);
        return rules;
    }

    public static async get(id: Rule["id"]): Promise<Rule> {
        const rules = await Rule.query();
        const rule = rules.find((r) => r.id === id);
        if (rule === undefined) {
            throw new Error(`No rule with id: ${id}`);
        }
        return rule;
    }

    public static async delete(id: Rule["id"]) {
        console.debug("Delete rule", id);
        try {
            if (id) {
                await storage.remove(id);
            }
        } catch (error) {
            console.error(error);  // Maybe this should raise an error?
        }
    }

    public static fromStorage(storageRule: IStorageRule): Rule {
        return new Rule(
            storageRule.title,
            storageRule.host,
            storageRule.sources,
            storageRule.ignores,
            storageRule.interval,
            storageRule.id,
            new Date(storageRule.created),
            new Date(storageRule.modified),
            storageRule.inlinecss,
            storageRule.inlineframes,
        );
    }

    constructor(
        public title: string,
        public host: string,
        public sources: string[] = [],
        public ignores: string[] = [],
        public interval: number = 2,
        public id = Math.random().toString(36).substr(2),
        public created = new Date(),
        public modified = new Date(),
        public inlinecss = true,
        public inlineframes = true,
    ) {
    }

    get hostRegExp(): RegExp {
        return matchPattern.toRegExp(this.host);
    }

    get sourceRegExps(): RegExp[] {
        return this.sources.map((source) => matchPattern.toRegExp(source));
    }

    get ignoresRegExps(): RegExp[] {
        return this.ignores.map((ignore) => matchPattern.toRegExp(ignore));
    }

    get intervalMs(): number {
        return this.interval * 1000;
    }

    public toStorage(): IStorageRule {
        return {
            _type: StorageType.Rule,
            id: this.id,
            title: this.title,
            host: this.host,
            sources: this.sources,
            ignores: this.ignores,
            interval: this.interval,
            inlinecss: this.inlinecss,
            inlineframes: this.inlineframes,
            created: this.created.getTime(),
            modified: this.modified.getTime(),
        };
    }

    public async save(): Promise<Rule> {
        try {
            await storage.set({[this.id]: this.toStorage()});
        } catch (error) {
            throw new Error(`Error saving rule: ${error.message}`);
        }
        return this;
    }

}

export { Rule };
