import puppeteer from 'puppeteer';

export async function renderPDF(url: string, output: string) {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.goto(url, {
        waitUntil: 'networkidle0',
    });
    await page.pdf({
        path: output,
        displayHeaderFooter: false,
        headerTemplate: '',
        footerTemplate: '',
        printBackground: true,
        format: 'a4',
    });
    await browser.close();
}