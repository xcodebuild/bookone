import colors from 'colors';
import { throttle } from 'lodash';
import watch from 'node-watch';
import ora from 'ora';

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

    spinner = ora('Starting').start();
    const length = tasks.length;
    spinner.color = 'yellow';

    while (tasks.length > 0) {
        const task = tasks.shift();
        const text = `[${colors.green(
            String(length - tasks.length) + ' DONE',
        )}/${length} TOTAL] ${task?.text}`;
        spinner.text = text;
        spinner.render();
        task?.run();
    }

    spinner.color = 'green';

    if (!isWatchMode) {
        spinner.stop();
    } else {
        spinner.text = 'Keep watching for change';
    }
}

const runTasksLazy = throttle(runTasks, 100);