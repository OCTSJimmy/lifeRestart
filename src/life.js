import {weightRandom} from './functions/util.js'
import Property from './property.js';
import Event from './event.js';
import Talent from './talent.js';
import Achievement from './achievement.js';

class Life {
    constructor() {
        this.#property = new Property();
        this.#event = new Event();
        this.#talent = new Talent();
        this.#achievement = new Achievement();
    }

    #property;
    #event;
    #talent;
    #achievement;
    #triggerTalents;

    async initial() {
        const [age, talents, events, achievements] = await Promise.all([
            json('age'),
            json('talents'),
            json('events'),
            json('achievement'),
        ])
        console.log(age);
        this.#property.initial({age});
        this.#talent.initial({talents});
        this.#event.initial({events});
        this.#achievement.initial({achievements});
    }

    restart(allocation) {
        this.#triggerTalents = {};
        const contents = this.talentReplace(allocation.TLT);
        this.#property.restart(allocation);
        this.doTalent()
        this.#property.restartLastStep();
        this.#achievement.achieve(
            this.#achievement.Opportunity.START,
            this.#property
        )
        return contents;
    }

    getTalentAllocationAddition(talents) {
        return this.#talent.allocationAddition(talents);
    }

    getTalentCurrentTriggerCount(talentId) {
        return this.#triggerTalents[talentId] || 0;
    }

    next() {
        const {age, event, talent} = this.#property.ageNext();

        const talentContent = this.doTalent(talent);
        const eventContent = this.doEvent(this.random(event));

        const isEnd = this.#property.isEnd();

        const content = [talentContent, eventContent].flat();
        this.#achievement.achieve(
            this.#achievement.Opportunity.TRAJECTORY,
            this.#property
        )
        return {age, content, isEnd};
    }

    ageTo(age, eventId) {
        const {ageInt, event, talent} = this.#property.ageTo(age);
        let talentContent;
        let eventContent
        if (talent !== undefined && talent) {
            let tlt = this.#property.get(this.#property.TYPES.TLT);
            if (tlt.map(({id}) => id).indexOf(talent.id) === -1) {
                tlt = tlt.push(talent)
                this.#property.set(this.#property.TYPES.TLT, tlt);
            }
            talentContent = this.doTalent(talent);
        }
        if (event !== undefined && event) {
            let rndEvent = this.random(event);
            if (rndEvent !== undefined && event) {
                eventContent = this.doEvent(rndEvent);
            }
        }
        let isEnd = this.#property.isEnd();
        let content = [];
        if(talentContent && eventContent) {
            content.push([talentContent, eventContent].flat());
        }
        this.#achievement.achieve(
            this.#achievement.Opportunity.TRAJECTORY,
            this.#property
        )

        for (let id of eventId) {
            let item = this.#event.getWithoutException(id);
            if (item === undefined || !item) {
                item = this.getTalentWithoutException(id);
                if (item === undefined || !item) continue;
                talentContent = this.doTalent([id]);
                eventContent = "";
            } else {
                if (item) {
                    eventContent = this.doEvent(id);
                    talentContent = "";
                }
            }
            isEnd = this.#property.isEnd();
            if (isEnd) {
                break;
            }
            content.push([talentContent, eventContent].flat());
            this.#achievement.achieve(
                this.#achievement.Opportunity.TRAJECTORY,
                this.#property
            )
        }
        return {ageInt, content, isEnd};
    }

    talentReplace(talents) {
        const result = this.#talent.replace(talents);
        const contents = [];
        for (const id in result) {
            talents.push(result[id]);
            const source = this.#talent.get(id);
            const target = this.#talent.get(result[id]);
            contents.push({
                type: 'talentReplace',
                source, target
            });
        }
        return contents;
    }

    doTalent(talents) {
        if (talents) this.#property.change(this.#property.TYPES.TLT, talents);
        talents = this.#property.get(this.#property.TYPES.TLT)
            .filter(talentId => this.getTalentCurrentTriggerCount(talentId) < this.#talent.get(talentId).max_triggers);

        const contents = [];
        for (const talentId of talents) {
            const result = this.#talent.do(talentId, this.#property);
            if (!result) continue;
            this.#triggerTalents[talentId] = this.getTalentCurrentTriggerCount(talentId) + 1;
            const {effect, name, description, grade} = result;
            contents.push({
                type: this.#property.TYPES.TLT,
                name,
                grade,
                description,
            })
            if (!effect) continue;
            this.#property.effect(effect);
        }
        return contents;
    }

    doEvent(eventId) {
        const {effect, next, description, postEvent} = this.#event.do(eventId, this.#property);
        this.#property.change(this.#property.TYPES.EVT, eventId);
        this.#property.effect(effect);
        const content = {
            type: this.#property.TYPES.EVT,
            description,
            postEvent,
        }
        if (next) return [content, this.doEvent(next)].flat();
        return [content];
    }

    random(events) {
        return weightRandom(
            events.filter(
                ([eventId]) => this.#event.check(eventId, this.#property)
            )
        );
    }

    talentRandom(talentRandomMax = 10) {
        const times = this.#property.get(this.#property.TYPES.TMS);
        const achievement = this.#property.get(this.#property.TYPES.CACHV);
        return this.#talent.talentRandom(this.getLastExtendTalent(), {times, achievement}, talentRandomMax);
    }

    getProperty(type) {
        return this.#property.get(type);
    }

    getPropertyType() {
        return this.#property.TYPES;
    }

    getTalent(talentId) {
        return this.#talent.get(talentId);
    }

    getTalentWithoutException(talentId) {
        return this.#talent.getWithoutException(talentId);
    }

    talentExtend(talentId) {
        this.#property.set(this.#property.TYPES.EXT, talentId);
    }

    getLastExtendTalent() {
        return this.#property.get(this.#property.TYPES.EXT);
    }

    getSummary() {
        this.#achievement.achieve(
            this.#achievement.Opportunity.SUMMARY,
            this.#property
        )

        let HAGE = this.#property.get(this.#property.TYPES.HAGE);
        let HCHR = this.#property.get(this.#property.TYPES.HCHR);
        let HINT = this.#property.get(this.#property.TYPES.HINT);
        let HSTR = this.#property.get(this.#property.TYPES.HSTR);
        let HMNY = this.#property.get(this.#property.TYPES.HMNY);
        let HSPR = this.#property.get(this.#property.TYPES.HSPR);
        let TLT = this.#property.get(this.#property.TYPES.TLT);
        let SUM = this.#property.get(this.#property.TYPES.SUM);
        let CACHV = this.#property.get(this.#property.TYPES.CACHV);
        HAGE = HAGE ?　parseInt(HAGE):0;
        HCHR = HCHR ? HCHR.toFixed(2):0;
        HINT = HINT ? HINT.toFixed(2):0;
        HSTR = HSTR ? HSTR.toFixed(2):0;
        HMNY = HMNY ? HMNY.toFixed(2):0;
        HSPR = HSPR ? HSPR.toFixed(2):0;
        SUM = SUM ? SUM : 0;
        return {
            AGE: HAGE,
            CHR: HCHR,
            INT: HINT,
            STR: HSTR,
            MNY: HMNY,
            SPR: HSPR,
            SUM: SUM,
            TLT: TLT,
            CACHV: CACHV
        };
    }

    getLastRecord() {
        return this.#property.getLastRecord();
    }

    exclusive(talents, exclusive) {
        return this.#talent.exclusive(talents, exclusive);
    }

    getAchievements() {
        const ticks = {};
        this.#property
            .get(this.#property.TYPES.ACHV)
            .forEach(([id, tick]) => ticks[id] = tick);
        return this
            .#achievement
            .list(this.#property)
            .sort((
                {id: a, grade: ag, hide: ah},
                {id: b, grade: bg, hide: bh}
            ) => {
                a = ticks[a];
                b = ticks[b];
                if (a && b) return b - a;
                if (!a && !b) {
                    if (ah && bh) return bg - ag;
                    if (ah) return 1;
                    if (bh) return -1;
                    return bg - ag;
                }
                if (!a) return 1;
                if (!b) return -1;
            });
    }

    getTotal() {
        const TMS = this.#property.get(this.#property.TYPES.TMS);
        const CACHV = this.#property.get(this.#property.TYPES.CACHV);
        const CTLT = this.#property.get(this.#property.TYPES.CTLT);
        const CEVT = this.#property.get(this.#property.TYPES.CEVT);

        const totalTalent = this.#talent.count();
        const totalEvent = this.#event.count();

        return {
            times: TMS,
            achievement: CACHV,
            talentRate: CTLT / totalTalent,
            eventRate: CEVT / totalEvent,
        }
    }

    get times() {
        return this.#property?.get(this.#property.TYPES.TMS) || 0;
    }

    set times(v) {
        this.#property?.set(this.#property.TYPES.TMS, v) || 0;
        this.#achievement.achieve(
            this.#achievement.Opportunity.END,
            this.#property
        )
    }
}

export default Life;

