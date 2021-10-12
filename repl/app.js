import {summary} from '../src/functions/summary.js'
import {readFile} from 'fs/promises';
import Life from '../src/life.js';

globalThis.json = async fileName => JSON.parse(await readFile(`data/${fileName}.json`));

globalThis.$$eventMap = new Map();
globalThis.$$event = (tag, data) => {
    const listener = $$eventMap.get(tag);
    if (listener) listener.forEach(fn => fn(data));
}
globalThis.$$on = (tag, fn) => {
    let listener = $$eventMap.get(tag);
    if (!listener) {
        listener = new Set();
        $$eventMap.set(tag, listener);
    }
    listener.add(fn);
}
globalThis.$$off = (tag, fn) => {
    const listener = $$eventMap.get(tag);
    if (listener) listener.delete(fn);
}

class App {
    constructor() {
        this.#life = new Life();
    }

    Steps = {
        TALENT: 'talent',
        PROPERTY: 'property',
        TRAJECTORY: 'trajectory',
        SUMMARY: 'summary',
    };

    #step = this.Steps.SUMMARY;
    #life;
    #talentSelected = new Set();
    #talentExtend = new Set();
    #input;
    #auto;
    #isEnd;
    #propertyAllocation;
    #output;
    #exit;
    #interval;
    #style = {
        white: ['\x1B[97m', '\x1B[39m'], // White
        warn: ['\x1B[93m', '\x1B[39m'], // Bright Yellow
        grade1: ['\x1B[94m', '\x1B[39m'], // Bright Blue
        grade2: ['\x1B[95m', '\x1B[39m'], // Bright Magenta
        grade3: ['\x1B[93m', '\x1B[39m'], // Bright Yellow
        grade1b: ['\x1B[94m\x1B[7m', '\x1B[0m'], // Bright Blue BG
        grade2b: ['\x1B[95m\x1B[7m', '\x1B[0m'], // Bright Magenta BG
        grade3b: ['\x1B[93m\x1B[7m', '\x1B[0m'], // Bright Yellow BG
    };
    #randomTalents;
    #TALENT_MAX = 3;
    #TALENT_RANDOM_MAX = 10;
    #TALENT_EASY_MAX = 7;
    #TALENT_RANDOM_EASY_MAX = 60;
    #currentTalentMax = this.#TALENT_MAX;
    #currentTalentRandomMax = this.#TALENT_RANDOM_MAX;

    #defaultTalents = {
        "30": [1022, 1071, 1040],
        "50": [1048, 1044],
        "70": [1023, 1017],
        "100": [1141, 1043],
        "120": [1016, 1064, 1072]
    };

    style(type, str) {
        const style = this.#style[type];
        if (!style) return str;
        return `${style[0]}${str}${style[1]}`;
    }

    async initial() {
        this.output('Now Loading...');
        this.#talentExtend = localStorage.talentExtend;
        await this.#life.initial();
        this.output(`\rLoading Complete.
人生重开模拟器
这垃圾人生一秒也不想待了
\n🎉键入 \x1B[4m/remake\x1B[24m 开始游戏（10连抽）
\n🎉键入 \x1B[4m/remake easy\x1B[24m 开始简单游戏（60连抽）
`,
            true
        );
        $$on('achievement', ({name}) => this.output(`
-------------------------
    解锁成就【${name}】
-------------------------
`))
    }

    io(input, output, exit) {
        this.#input = input;
        this.#output = output;
        this.#exit = exit;
        input(command => {
            const ret = this.repl(command);
            if (!ret) return;
            if (typeof ret == 'string') return this.output(ret, true);
            if (Array.isArray(ret)) return this.output(...ret);
            const {message, isRepl} = ret;
            return this.output(message, isRepl);
        });
    }

    output(data, isRepl) {
        if (!this.#output) return;
        this.#output(data, isRepl);
    }

    exit(code) {
        if (this.#exit) this.#exit(code);
        process.exit(code);
    }

    repl(command) {
        command = command.split(/\s+/);
        switch (command.shift()) {

            case 'r':
            case 'remake':
            case '/remake':
                return this.remake(...command);

            case 's':
            case 'select':
            case '/select':
                return this.select(...command);

            case 'u':
            case 'unselect':
            case '/unselect':
                return this.unselect(...command);

            case 'n':
            case 'next':
            case '/next':
                return this.next(true, this.#currentTalentRandomMax);
            case 'e':
            case 'easy':
            case '/easy':
                return this.easy(true, this.#currentTalentRandomMax);
            case 'a':
            case 'alloc':
            case 'allocate':
            case 'attrib':
            case 'attribute':
            case '/alloc':
            case '/allocate':
            case '/attrib':
            case '/attribute': return this.attrib(...command);

            case 'rd':
            case 'random':
            case '/random':
                return this.random();

            case 'at':
            case 'auto':
            case '/auto':
                return this.auto(...command);

            case 'x':
            case 'exit':
            case '/exit':
                return this.exit(0);

            case '?':
            case 'h':
            case 'help':
            case '/?':
            case '/h':
            case '/help':
            default:
                return this.help(...command);

            case 'age':
                return this.age(...command);
            case '!':
            case 'state':
                return this.state();
        }
    }

    help(key) {

        switch (key) {
            case 'x':
            case 'exit':
            case '/exit':
                return `退出
    x, exit, /exit      命令同等效果`;

            case 'r':
            case 'remake':
            case '/remake':
                return `重开
    r, remake, /remake  命令同等效果`;

            case 's':
            case 'select':
            case '/select':
                return `选择
    s, select, /select  命令同等效果

    Example:    /select 1 2 3 意味着选择 1 2 3 三个天赋

                /select <id1> [id2] [id3]

    参数解释     <id1>   通常来说要指定至少一个id
                        虽然不指定也可以
                [id2]
                [id3]   可以不指定`;

            case 'u':
            case 'unselect':
            case '/unselect':
                return `取消选择
    u, unselect,
    /unselect           命令同等效果

    Example:    /unselect 1 2 3
                意味着取消选择 1 2 3 三个天赋

    参数解释     /unselect <id1> [id2] [id3]

                <id1>   通常来说要指定至少一个id
                        虽然不指定也可以
                [id2]
                [id3]   可以不指定`;


            case 'a':
            case 'alloc':
            case 'allocate':
            case 'attrib':
            case 'attribute':
            case '/alloc':
            case '/allocate':
            case '/attrib':
            case '/attribute': return `分配或查看属性点
    a, alloc, allocate, attrib, attribute
    /alloc, /allocate, /attrib, /attribute 命令同等效果

    Example:    /attribute
                /allocate STR 1
                /allocate INT -3
                /allocate CHR +5

    效果        在属性分配时分配属性点
                在人生的过程中查看当前属性点

    参数解释    /allocate <TAG> <[+/-]value>

                <TAG>   表示要分配的属性标签
                        可选有
                            CHR, chr, c, C 表示颜值
                            INT, int, i, I 表示智力
                            STR, str, s, S 表示体质
                            MNY, mny, m, M 表示家境
                        必填

                <[+/-]value>
                        表示属性的调整
                        其中
                            + 表示在当前基础上增加
                            - 表示在当前基础上减少
                            无符号表示直接设置为此值
                        必填`;

            case 'n':
            case 'next':
            case '/next':
                return `继续
    n, next, /next      命令同等效果

    效果                通常用于各步骤结束后
                        例如：  选择天赋后
                                分配属性后
                                每个年龄事件后
                                总评后
                                继承天赋后`;
            case 'e':
            case 'easy':
            case '/easy':
                return `以简单模式开始
    e, easy, /easy      命令同等效果
    效果                 通常用于选择天赋后，以简单模式进入分配属性环节`;

            case 'at':
            case 'auto':
            case '/auto':
                return `自动播放
    at, auto, /auto    命令同等效果

    效果                用于人生的过程中
                        每个年龄会自动下一年
                        播放速度 1 秒 1 年`;
            case 'age':
                return `设置年龄
    age 年龄 [事件号或天赋号...] 
    
    效果                 跳到指定年龄，并且强制经历指定事件或者强制赋予指定天赋`;
            case '!':
            case 'state':
                return `显示当前状态
    !, state            命令同等效果            
    效果                 显示当前状态数值`;
            case '?':
            case 'h':
            case 'help':
            case '/?':
            case '/h':
            case '/help':
                return `显示帮助
    ？, h, help
    /?, /h, /help           命令同等效果

    Example:            /help
                        /help /select

    参数解释             /help [command]

            [command]   要详细显示帮助的命令
                        可以不填`;
        }
        return `Help ---
    命令            说明            示例
    x
    exit
    /exit           退出            /exit

    r
    remake
    /remake         重开            /remake

    s
    select
    /select         选择天赋        /select <id1> [id2] [id3]

    u
    unselect
    /unselect       取消选择        /unselect <id1> [id2] [id3]

    a
    alloc
    allocate
    attrib
    attribute
    /alloc
    /allocate
    /attrib
    /attribute      分配或查看属性点 /allocate <TAG> <[+/-]value>

    n
    next
    /next           继续            /next

    e
    easy
    /easy           以简单模式开始    /easy

    at
    auto
    /auto           自动播放        /auto
    
    age             跳到指定年龄     age <年龄> [事件ID]...
    state           显示当前状态     state
    
    ?
    h
    help
    /?
    /h
    /help           显示帮助        /help [command]`;
    }

    auto(arg) {
        this.#auto = arg != 'off';
        return this.next(true);
    }

    remake(arg) {
        if (this.#talentExtend) {
            this.#life.talentExtend(this.#talentExtend)
            dumpLocalStorage();
            this.#talentExtend = null;
        }
        if (arg === 'easy') {
            this.#currentTalentRandomMax = this.#TALENT_RANDOM_EASY_MAX;
            this.#currentTalentMax = this.#TALENT_EASY_MAX;
        } else {
            this.#currentTalentRandomMax = this.#TALENT_RANDOM_MAX;
            this.#currentTalentMax = this.#TALENT_MAX;
        }
        this.#isEnd = false;
        this.#talentSelected.clear();
        this.#propertyAllocation = {CHR: 0, INT: 0, STR: 0, MNY: 0, SPR: 5};
        this.#step = this.Steps.TALENT;
        this.#randomTalents = this.#life.talentRandom(this.#currentTalentRandomMax);
        return this.list();
    }

    select(...select) {
        switch (this.#step) {
            case this.Steps.TALENT:
                return this.talentSelect(...select);
            case this.Steps.SUMMARY:
                return this.talentExtend(...select);
        }
    }

    unselect(...select) {
        switch (this.#step) {
            case this.Steps.TALENT:
                return this.talentUnSelect(...select);
            case this.Steps.SUMMARY:
                return this.talentExtendCancle(...select);
        }
    }

    age(age, ...eventId) {
        const warn = str => `${this.list()}\n${this.style('warn', str)}`;
        const trajectory = this.#life.ageTo(age, eventId);
        const {ageInt, content, isEnd} = trajectory;

        if (isEnd) this.#isEnd = true;
        let tmp = String(ageInt);
        tmp = tmp.split(".");
        tmp[1] = parseInt(tmp[1]);
        let season = "春"
        switch (tmp[1]) {
            case 1:
                season = "春";
                break;
            case 2:
                season = "夏";
                break;
            case 3:
                season = "秋";
                break;
            case 4:
                season = "冬";
                break;
            default:
                season = "春";
        }
        let result = [];
        return `${tmp[0]}岁${season}：\t${
            content.map(c => {
                    for (let {type, description, grade, name, postEvent} of c) {
                        switch (type) {
                            case 'TLT':
                                result.push(`天赋【${name}】发动：${description}`);
                            case 'EVT':
                                result.push(description + (postEvent ? `\n\t${postEvent}` : ''));
                        }
                    }
                    return result;
                }
            ).join('\n\t')
        }`;
    }

    talentSelect(...select) {
        const warn = str => `${this.list()}\n${this.style('warn', str)}`;
        for (const number of select) {
            const s = this.#randomTalents[number];
            if (!s) return warn(`${number} 为未知天赋`);
            if (this.#talentSelected.has(s)) continue;
            if (this.#talentSelected.size == this.#currentTalentMax)
                return warn(`⚠只能选${this.#currentTalentMax}个天赋`);

            const exclusive = this.#life.exclusive(
                Array.from(this.#talentSelected).map(({id}) => id),
                s.id
            );

            if (exclusive != null)
                for (const {name, id} of this.#talentSelected)
                    if (id == exclusive)
                        return warn(`天赋【${s.name}】与已选择的天赋【${name}】冲突`);

            this.#talentSelected.add(s);
        }

        return this.list();
    }

    talentUnSelect(...select) {
        for (const number of select) {
            const s = this.#randomTalents[number];
            if (this.#talentSelected.has(s))
                this.#talentSelected.delete(s);
        }

        return this.list();
    }

    talentExtend(select) {
        const warn = str => `${this.list()}\n${this.style('warn', str)}`;
        const list = Array.from(this.#talentSelected);
        const s = list[select];
        if (!s) return warn(`${select} 为未知天赋`);
        this.#talentExtend = s.id;
        return this.list();
    }

    talentExtendCancle() {
        this.#talentExtend = null;
    }

    list() {
        let description, list, check;
        switch (this.#step) {
            case this.Steps.TALENT:
                description = `🎉 请选择${this.#currentTalentMax}个天赋`;
                list = this.#randomTalents;
                check = talent => this.#talentSelected.has(talent);
                break;
            case this.Steps.SUMMARY:
                description = '🎉 你可以选（\x1B[4m/select\x1B[24m）一个天赋继承';
                list = Array.from(this.#talentSelected);
                check = ({id}) => this.#talentExtend == id;
                break;
        }
        if (!list) return '';

        return [description, list.map(
            (talent, i) =>
                this.style(
                    `grade${talent.grade}b`,
                    this.style(talent.grade > 0 ? `white` : "grade0", `${check(talent) ? '√' : ' '} ${i} ${talent.name}（${talent.description}）`)
                )
        ), `🎉 选择结束后，输入n、next、/next来进入普通模式`, `🎉 选择结束后，输入e、easy、/easy来进入简单模式`]
            .flat()
            .join('\n');
    }

    addDefaultTalent() {
        const selected = this.#talentSelected;
        if (this.#defaultTalents) {
            const propertyType = this.#life.getPropertyType();
            const cachvType = propertyType.CACHV
            const cachv = this.#life.getProperty(cachvType);
            const talent = [];
            const talentsId = this.#defaultTalents;
            for (let key in talentsId) {
                let isPass = false;
                if (cachv < parseInt(key)) {
                    isPass = true;
                    continue;
                }
                for (let value of talentsId[key]) {
                    isPass = false;
                    for (let t of selected.values()) {
                        if (t.id === value) {
                            isPass = true;
                            break;
                        }
                    }
                    if (isPass) {
                        continue;
                    }
                    talent.push(this.#life.getTalent(value));
                }
            }
            if (talent) {
                talent.forEach(t => {
                    this.#talentSelected.add(t);
                })

                const sorted = Array.from(this.#talentSelected).sort((a, b) => {
                    let result = b.grade - a.grade;
                    if (result === 0) {
                        result = a.id - b.id;
                    }
                    return result;
                })
                this.#talentSelected.clear();
                sorted.forEach(v => {
                    this.#talentSelected.add(v);
                })
            }
        }
    }

    easy(enter, talentRandomMax) {
        return this.nextCore(enter, talentRandomMax, true);
    }

    nextCore(enter, talentRandomMax, isEasyMode) {
        if (!talentRandomMax) {
            talentRandomMax = this.#currentTalentRandomMax;
        }
        const warn = (a, b) => `${a}\n${this.style('warn', this.style('warn', b))}`;
        switch (this.#step) {
            case this.Steps.TALENT:
                if (this.#talentSelected.size != this.#currentTalentMax) return warn(this.list(), `⚠请选择${this.#currentTalentMax}个天赋`);
                // 已经选完天赋
                if (isEasyMode) this.addDefaultTalent();
                this.#step = this.Steps.PROPERTY;
                this.#propertyAllocation.total = 20 + this.#life.getTalentAllocationAddition(
                    Array.from(this.#talentSelected).map(({id}) => id)
                );
                this.#propertyAllocation.TLT = Array.from(this.#talentSelected).map(({id}) => id);
                return this.prop();
            case this.Steps.PROPERTY:
                const less = this.less();
                if (less > 0) return warn(this.prop(), `你还有${less}属性点没有分配完`);
                this.#step = this.Steps.TRAJECTORY;
                delete this.#propertyAllocation.total;
                this.#life.restart(this.#propertyAllocation);
                return this.trajectory(enter);
            case this.Steps.TRAJECTORY:
                if (!this.#isEnd) return this.trajectory(enter);
                this.#step = this.Steps.SUMMARY;
                return `${
                    this.summary()
                }\n\n${
                    this.list()
                }`;
            case this.Steps.SUMMARY:
                return this.remake(talentRandomMax);
        }
    }

    next(enter, talentRandomMax) {
        return this.nextCore(enter, talentRandomMax, false);
    }

    trajectory(enter) {
        if (enter) {
            if (this.#interval) {
                clearInterval(this.#interval);
                this.#interval = null;
                this.#auto = false;
            } else if (this.#auto) {
                this.#interval = setInterval(
                    () => {
                        const trajectory = this.next();
                        if (this.#isEnd && this.#interval) {
                            clearInterval(this.#interval);
                            this.#interval = null;
                        }
                        if (!this.#isEnd) return this.output(`${trajectory}\n`);
                        return this.output(trajectory, true);
                    }
                    , 300);
                return;
            }
        }
        const {
            CHR: snapshotCHR,
            INT: snapshotINT,
            STR: snapshotSTR,
            MNY: snapshotMNY,
            SPR: snapshotSPR,
            AGE: snapshotAGE,
            TLT: snapshotTLT
        } = this.#life.getLastRecord();
        const trajectory = this.#life.next();

        const {age, content, isEnd} = trajectory;
        const {CHR, INT, STR, MNY, SPR, AGE, TLT} = this.#life.getLastRecord();

        let diff = "";
        if (snapshotCHR !== CHR) {
            diff += this.style('warn', `\n\t\t 颜值(CHR) ${snapshotCHR} → ${CHR}`);
        }

        if (snapshotINT !== INT) {
            diff += this.style('warn', `\n\t\t 智力(INT) ${snapshotINT} → ${INT}`);
        }

        if (snapshotSTR !== STR) {
            diff += this.style('warn', `\n\t\t 体质(STR) ${snapshotSTR} → ${STR}`);
        }

        if (snapshotMNY !== MNY) {
            diff += this.style('warn', `\n\t\t 家境(MNY) ${snapshotMNY} → ${MNY}`);
        }

        if (snapshotSPR !== SPR) {
            diff += this.style('warn', `\n\t\t 快乐(SPR) ${snapshotSPR} → ${SPR}`);
        }

        if (isEnd) this.#isEnd = true;
        let tmp = String(age);
        tmp = tmp.split(".");
        tmp[1] = parseInt(tmp[1]);
        let season = "春"
        switch (tmp[1]) {
            case 1:
                season = "春";
                break;
            case 2:
                season = "夏";
                break;
            case 3:
                season = "秋";
                break;
            case 4:
                season = "冬";
                break;
            default:
                season = "春";
        }
        let result = `${tmp[0]}岁${season}：\t${
            content.map(
                ({type, description, grade, name, postEvent}) => {
                    switch (type) {
                        case 'TLT':
                            return `天赋【${name}】发动：${description}`;
                        case 'EVT':
                            return description + (postEvent ? `\n\t \t${postEvent}` : '');
                    }
                }
            ).join(`\n\t\t`)
        }`;
        if (diff.length > 0) {
            result += diff
        }
        return result;
    }

    trajectoryState() {
        const lastRecord = this.#life.getLastRecord();
        const {TLT, CACHV} = lastRecord;
        const format = (name, type) => {
            const value = lastRecord[type];
            const {judge, grade} = summary(type, value);
            return this.style(`grade${grade}b`,
                this.style(grade > 0 ? `white` : "grade0", `${name}：${value} ${judge}`)
            );
        }

        let str = [
            '🎉 当前状态：',
            format('颜值', 'CHR'),
            format('智力', 'INT'),
            format('体质', 'STR'),
            format('家境', 'MNY'),
            format('快乐', 'SPR'),
            format('享年', 'AGE'),
            format('总评', 'SUM'),
            format('成就', 'CACHV')
        ].join('\n');

        let talents = TLT ? TLT.map(v => this.#life.getTalent(v)) : [];
        let TLT_STR = `天赋：\t${talents.map(
            (talent, i) =>
                this.style(
                    `grade${talent.grade}b`,
                    this.style(talent.grade > 0 ? `white` : "grade0", `${i} ${talent.name}（${talent.description}）`)
                )
        ).join('\n\t')}`;

        return [str, TLT_STR].join('\n');
    }

    state() {
        const warn = (a, b) => `${a}\n${this.style('warn', this.style('warn', b))}`;
        let list = this.#randomTalents.filter(t => this.#talentSelected.has(t));
        switch (this.#step) {
            case this.Steps.TALENT:
                return this.list();
            case this.Steps.PROPERTY:
                return `天赋已选择：\n\t${
                    list.map(
                        (talent, i) =>
                            this.style(
                                `grade${talent.grade}b`,
                                this.style(talent.grade > 0 ? `white` : "grade0", `${i} ${talent.name}（${talent.description}）`)
                            )
                    ).join('\n\t')
                }\n\n${
                    this.prop()
                }`;
            case this.Steps.TRAJECTORY:
                return this.trajectoryState();
            case this.Steps.SUMMARY:
                return `${
                    this.summary()
                }\n\n${
                    this.list()
                }`;
        }


    }


    prop() {
        const {CHR, INT, STR, MNY} = this.#propertyAllocation;
        return `🎉属性分配
剩余点数 ${this.less()}

属性(TAG)       当前值
颜值(CHR)         ${CHR}
智力(INT)         ${INT}
体质(STR)         ${STR}
家境(MNY)         ${MNY}
        `
    }

    less() {
        const {total, CHR, INT, STR, MNY} = this.#propertyAllocation;
        return total - CHR - INT - STR - MNY;
    }

    attrib(tag, value) {
        switch (this.#step) {
            case this.Steps.PROPERTY:
                return this.alloc(tag, value);

            case this.Steps.TRAJECTORY:
                return this.showProperty();

            default:
                return undefined;
        }
    }

    showProperty() {
        let property = this.#life.getLastRecord();
        return `当前属性

属性(TAG)       当前值
颜值(CHR)         ${property.CHR}
智力(INT)         ${property.INT}
体质(STR)         ${property.STR}
家境(MNY)         ${property.MNY}
快乐(SPR)         ${property.SPR}`
    }

    alloc(tag, value) {
        const warn = str => `${this.prop()}\n${this.style('warn', str)}`
        if (!value) return warn('⚠ 分配的数值没有给定');
        const isSet = !(value[0] == '-' || value[0] == '+');

        value = Number(value);
        if (isNaN(value)) return warn('⚠ 分配的数值不正确');

        switch (tag) {
            case 'c':
            case 'chr':
            case 'C':
                tag = 'CHR';
                break;
            case 'i':
            case 'int':
            case 'I':
                tag = 'INT';
                break;
            case 's':
            case 'S':
            case 'str':
                tag = 'STR';
                break;
            case 'm':
            case 'M':
            case 'mny':
                tag = 'MNY';
                break;
        }


        switch (tag) {
            case 'CHR':
            case 'INT':
            case 'STR':
            case 'MNY':
                if (isSet) value = value - this.#propertyAllocation[tag];

                const tempLess = this.less() - value;
                const tempSet = this.#propertyAllocation[tag] + value;

                if (tempLess < 0) return warn('⚠ 你没有更多的点数可以分配了');
                if (
                    tempLess > this.#propertyAllocation.total
                    || tempSet < 0
                ) return warn('⚠ 不能分配负数属性');
                if (tempSet > 10) return warn('⚠ 单项属性最高分配10点');

                this.#propertyAllocation[tag] += value;

                return this.prop();

            default:
                return warn('⚠ 未知的tag');
        }
    }

    random() {
        let t = this.#propertyAllocation.total;
        const arr = [10, 10, 10, 10];
        while (t > 0) {
            const sub = Math.round(Math.random() * (Math.min(t, 10) - 1)) + 1;
            while (true) {
                const select = Math.floor(Math.random() * 4) % 4;
                if (arr[select] - sub < 0) continue;
                arr[select] -= sub;
                t -= sub;
                break;
            }
        }
        this.#propertyAllocation.CHR = 10 - arr[0];
        this.#propertyAllocation.INT = 10 - arr[1];
        this.#propertyAllocation.STR = 10 - arr[2];
        this.#propertyAllocation.MNY = 10 - arr[3];
        return this.prop();
    }

    summary() {
        const summaryData = this.#life.getSummary();
        const format = (name, type) => {
            const value = summaryData[type];
            const {judge, grade} = summary(type, value);
            return this.style(`grade${grade}b`,
                this.style(grade > 0 ? `white` : "grade0", `${name}：${value} ${judge}`)
            );
        }

        return [
            '🎉 总评',
            format('颜值', 'CHR'),
            format('智力', 'INT'),
            format('体质', 'STR'),
            format('家境', 'MNY'),
            format('快乐', 'SPR'),
            format('享年', 'AGE'),
            format('总评', 'SUM'),
        ].join('\n');
    }
}

export default App;