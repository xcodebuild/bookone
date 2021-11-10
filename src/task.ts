import colors from 'colors';
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
            });
        });
    }
}

export const runTasks = () => {
    const length = tasks.length;

    while (tasks.length > 0) {
        const task = tasks.shift();
        console.log(
            `[${colors.green(
                String(length - tasks.length) + ' DONE',
            )}/${length} TOTAL] ${task?.text}`,
        );
        task?.run();
    }
}