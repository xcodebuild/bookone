import colors from 'colors';
import { throttle } from 'lodash';
import watch from 'node-watch';

const tasks: Array<{
	text: string;
	run: () => void;
}> = [];

let isWatchMode = false;

export function setWatchMode() {
    isWatchMode = true;
}

export function addTask(text: string, run: () => void, listenFile?: string[]) {
	tasks.push({
		text,
		run,
	});

    if (isWatchMode) {
        listenFile?.forEach((file) => {
            watch(file, {recursive: true}, (evt, name) => {
                const tip = colors.yellow(`file change ${name}`);
                addTask(`[${tip}] ${text}`, run);
                runTasksLazy();
            });
        });
    }
}

let spinner: any;


export const runTasks = async () => {

    const length = tasks.length;

    while (tasks.length > 0) {
        const task = tasks.shift();
        const percent = Math.floor((length - tasks.length)/length * 100);
        const text = `[${colors.green(''+percent + '%')}] ${task?.text}`;
        console.log(text);
        await task?.run();
    }
}

const runTasksLazy = throttle(() => new Promise(resolve => {
    resolve(runTasks());
}), 100);