interface UserOptions {
    [index: string]: boolean | null | string;
}

const defaults: UserOptions = {
    "show.badge": true,
    "meta.lastSaved": null,
};

export { UserOptions, defaults };
