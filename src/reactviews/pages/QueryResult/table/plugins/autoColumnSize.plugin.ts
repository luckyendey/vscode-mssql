/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Adapted from https://github.com/naresh-n/slickgrid-column-data-autosize/blob/master/src/slick.autocolumnsize.js

import {
    QueryResultWebviewState,
    QueryResultReducers,
} from "../../../../../sharedInterfaces/queryResult";
import { TelemetryActions, TelemetryViews } from "../../../../../sharedInterfaces/telemetry";
import { WebviewTelemetryActionEvent } from "../../../../../sharedInterfaces/webview";
import { deepClone } from "../../../../common/utils";
import { VscodeWebviewContext } from "../../../../common/vscodeWebviewProvider";
import { mixin } from "../objects";
import { MAX_COLUMN_WIDTH_PX } from "../table";

export interface IAutoColumnSizeOptions extends Slick.PluginOptions {
    maxWidth?: number;
    autoSizeOnRender?: boolean;
    extraColumnHeaderWidth?: number;
}

const defaultOptions: IAutoColumnSizeOptions = {
    maxWidth: MAX_COLUMN_WIDTH_PX,
    autoSizeOnRender: false,
    extraColumnHeaderWidth: 0,
};

export const NUM_COLUMNS_TO_SCAN = 50;

export class AutoColumnSize<T extends Slick.SlickData> implements Slick.Plugin<T> {
    private _grid!: Slick.Grid<T>;
    private _$container!: JQuery;
    private _context!: CanvasRenderingContext2D;
    private _options: IAutoColumnSizeOptions;
    private onPostEventHandler = new Slick.EventHandler();

    constructor(
        options: IAutoColumnSizeOptions = defaultOptions,
        private webViewState: VscodeWebviewContext<QueryResultWebviewState, QueryResultReducers>,
    ) {
        this._options = mixin(options, defaultOptions, false);
        this.webViewState = webViewState;
    }

    public init(grid: Slick.Grid<T>) {
        this._grid = grid;
        if (this._options.autoSizeOnRender) {
            this.onPostEventHandler.subscribe(this._grid.onRendered, () => this.onPostRender());
        }

        this._$container = jQuery(this._grid.getContainerNode());
        this._$container.on("dblclick.autosize", ".slick-resizable-handle", (e) =>
            this.handleDoubleClick(e),
        );
        this._context = document.createElement("canvas").getContext("2d")!;
    }

    public destroy() {
        this._$container.off();
    }

    private onPostRender() {
        // this doesn't do anything if the grid isn't on the dom
        if (!this._grid.getContainerNode().isConnected) {
            return;
        }

        // since data can be async we want to only do this if we have the data to actual
        // work on since we are measuring the physical length of data
        let data = this._grid.getData() as Slick.DataProvider<T>;
        let item = data.getItem(0);
        if (item && Object.keys(item).length > 0) {
            let hasValue = false;
            for (let key in item) {
                if (item.hasOwnProperty(key)) {
                    if (item[key]) {
                        hasValue = true;
                        break;
                    }
                }
            }
            if (!hasValue) {
                return;
            }
        } else {
            return;
        }

        let headerColumnsQuery = jQuery(this._grid.getContainerNode()).find(
            ".slick-header-columns",
        );
        if (headerColumnsQuery && headerColumnsQuery.length) {
            let headerColumns = headerColumnsQuery[0];
            let origCols = this._grid.getColumns();
            let allColumns = deepClone(origCols);
            allColumns.forEach((col, index) => {
                col.formatter = origCols[index].formatter;
                col.asyncPostRender = origCols[index].asyncPostRender;
            });
            let change = false;
            let headerElements: HTMLElement[] = [];
            let columnDefs: Slick.Column<T>[] = [];
            let colIndices: number[] = [];

            for (let i = 0; i <= headerColumns.children.length; i++) {
                let headerEl = jQuery(headerColumns.children.item(i)! as HTMLElement);
                let columnDef = headerEl.data("column");
                if (columnDef) {
                    headerElements.push(headerEl[0]);
                    columnDefs.push(columnDef);
                    colIndices.push(this._grid.getColumnIndex(columnDef.id));
                }
            }

            let headerWidths: number[] = this.getElementWidths(headerElements);
            headerWidths = headerWidths.map((width) => {
                return width + this._options.extraColumnHeaderWidth!;
            });
            let maxColumnTextWidths: number[] = this.getMaxColumnTextWidths(columnDefs, colIndices);

            for (let i = 0; i < columnDefs.length; i++) {
                let colIndex: number = colIndices[i];
                let column: Slick.Column<T> = allColumns[colIndex];
                let autoSizeWidth: number = Math.max(headerWidths[i], maxColumnTextWidths[i]) + 1;
                if (autoSizeWidth !== column.width) {
                    allColumns[colIndex].width = autoSizeWidth;
                    change = true;
                }
            }

            if (change) {
                this.onPostEventHandler.unsubscribeAll();
                this._grid.setColumns(allColumns);
                this._grid.onColumnsResized.notify();
            }
        }
    }

    private handleDoubleClick(e: JQuery.TriggeredEvent<HTMLElement, unknown>) {
        let headerEl = jQuery(e.currentTarget).closest(".slick-header-column");
        let columnDef = headerEl.data("column");

        if (!columnDef || !columnDef.resizable) {
            return;
        }

        e.preventDefault();
        e.stopPropagation();

        this.resizeColumn(headerEl, columnDef);
    }

    private resizeColumn(headerEl: JQuery, columnDef: Slick.Column<T>) {
        let headerWidth = this.getElementWidths([headerEl[0]])[0];
        let colIndex = this._grid.getColumnIndex(columnDef.id!);
        let origCols = this._grid.getColumns();
        let allColumns = deepClone(origCols);
        allColumns.forEach((col, index) => {
            col.formatter = origCols[index].formatter;
            col.asyncPostRender = origCols[index].asyncPostRender;
        });

        let autoSizeWidth =
            Math.max(headerWidth, this.getMaxColumnTextWidth(columnDef, colIndex)) + 1;

        allColumns[colIndex].width = autoSizeWidth;
        this._grid.setColumns(allColumns);
        this._grid.onColumnsResized.notify();
    }

    /**
     * For each column, find the max width of the texts in the first MAX_ROW_TO_SCAN rows.
     * @param columnDefs Column definitions of all columns that need to be resized
     * @param colIndices Column indices of all columns that need to be resized
     * @returns An array of the max widths of each column
     */
    private getMaxColumnTextWidths(columnDefs: Slick.Column<T>[], colIndices: number[]): number[] {
        let data = this._grid.getData() as Slick.DataProvider<T>;
        let dataLength = data.getLength();
        let viewPort = this._grid.getViewport();
        let start = Math.max(0, viewPort.top);
        let end = Math.min(dataLength, viewPort.bottom);
        // limit column width calculation to NUM_COLUMNS_TO_SCAN rows
        if (end < NUM_COLUMNS_TO_SCAN) {
            end = Math.min(NUM_COLUMNS_TO_SCAN, dataLength);
        }
        let allTexts: Array<string>[] = [];
        let rowElements: JQuery[] = [];

        columnDefs.forEach((columnDef) => {
            let texts: Array<string> = [];
            for (let i = start; i < end; i++) {
                texts.push(data.getItem(i)[columnDef.field!]);
            }
            allTexts.push(texts);
            let rowEl = this.createRow();
            rowElements.push(rowEl);
        });

        let templates = this.getMaxTextTemplates(
            allTexts,
            columnDefs,
            colIndices,
            data,
            rowElements,
        );

        let widths = this.getTemplateWidths(rowElements, templates);
        rowElements.forEach((rowElement) => {
            this.deleteRow(rowElement);
        });
        if (this._options.maxWidth) {
            return widths.map((width) => Math.min(this._options.maxWidth!, width));
        } else {
            return widths.map((width) => width);
        }
    }

    private getMaxColumnTextWidth(columnDef: Slick.Column<T>, colIndex: number): number {
        let texts: Array<string> = [];
        let rowEl = this.createRow();
        let data = this._grid.getData() as Slick.DataProvider<T>;
        let dataLength = data.getLength();
        let viewPort = this._grid.getViewport();
        let start = Math.max(0, viewPort.top);
        let end = Math.min(dataLength, viewPort.bottom);
        for (let i = start; i < end; i++) {
            texts.push(data.getItem(i)[columnDef.field!]);
        }
        // adding -1 for column since this is a single column resize
        let template = this.getMaxTextTemplate(texts, columnDef, colIndex, data, rowEl, -1);
        let width = this.getTemplateWidths([rowEl], [template])[0];
        this.deleteRow(rowEl);
        return width > this._options.maxWidth! ? this._options.maxWidth! : width;
    }

    private getTemplateWidths(
        rowElements: JQuery[],
        templates: (JQuery | HTMLElement | string)[],
    ): number[] {
        // Write all changes first then read all widths to prevent layout thrashing
        // (https://developers.google.com/web/fundamentals/performance/rendering/avoid-large-complex-layouts-and-layout-thrashing)
        const cells: JQuery[] = templates.map((template, index) => {
            let rowEl = rowElements[index];
            let cell = jQuery(rowEl.find(".slick-cell"));
            cell.append(template);
            jQuery(cell).find("*").css("position", "relative");
            return cell;
        });

        return cells.map((cell) => cell.outerWidth()! + 1);
    }

    private getMaxTextTemplates(
        allTexts: string[][],
        columnDefs: Slick.Column<T>[],
        colIndices: number[],
        data: Slick.DataProvider<T>,
        rowElements: JQuery[],
    ): (JQuery | HTMLElement | string)[] {
        let numColumns = columnDefs.length;
        return columnDefs.map((columnDef, index) =>
            this.getMaxTextTemplate(
                allTexts[index],
                columnDef,
                colIndices[index],
                data,
                rowElements[index],
                numColumns,
            ),
        );
    }

    private getMaxTextTemplate(
        texts: string[],
        columnDef: Slick.Column<T>,
        colIndex: number,
        data: Slick.DataProvider<T>,
        rowEl: JQuery,
        numColumns: number,
    ): JQuery | HTMLElement | string {
        let max = 0,
            maxTemplate: JQuery | HTMLElement | string | undefined;
        let formatFun = columnDef.formatter;
        let startTime = Date.now();
        texts.forEach((text, index) => {
            let template;
            if (formatFun) {
                template = jQuery(
                    "<span>" +
                        formatFun(index, colIndex, text, columnDef, data.getItem(index)) +
                        "</span>",
                );
                text = template.text() || text;
            }
            let length = text ? this.getElementWidthUsingCanvas(rowEl, text) : 0;
            if (length > max) {
                max = length;
                maxTemplate = template || text;
            }
        });
        let endTime = Date.now();
        let timeElapsed = endTime - startTime;
        let telemetryEvent: WebviewTelemetryActionEvent = {
            telemetryView: TelemetryViews.QueryResult,
            telemetryAction: TelemetryActions.AutoColumnSize,
            additionalMeasurements: {
                timeElapsedMs: timeElapsed,
                rows: texts.length,
                columns: numColumns,
            },
        };
        this.webViewState.extensionRpc.sendActionEvent(telemetryEvent);
        return maxTemplate!;
    }

    private createRow(): JQuery {
        let rowEl = jQuery('<div class="slick-row"><div class="slick-cell"></div></div>');
        rowEl.find(".slick-cell").css({
            visibility: "hidden",
            "text-overflow": "initial",
            "white-space": "nowrap",
        });
        let gridCanvas = this._$container.find(".grid-canvas");
        jQuery(gridCanvas).append(rowEl);
        return rowEl;
    }

    private deleteRow(rowEl: JQuery) {
        jQuery(rowEl).remove();
    }

    private getElementWidths(elements: HTMLElement[]): number[] {
        let clones: HTMLElement[] = [];
        let widths: number[] = [];

        // Write all changes first then read all widths to prevent layout thrashing
        // (https://developers.google.com/web/fundamentals/performance/rendering/avoid-large-complex-layouts-and-layout-thrashing)
        elements.forEach((element) => {
            let clone = element.cloneNode(true) as HTMLElement;
            clone.style.cssText =
                "position: absolute; visibility: hidden;right: auto;text-overflow: initial;white-space: nowrap;";
            element.parentNode!.insertBefore(clone, element);
            clones.push(clone);
        });

        clones.forEach((clone) => {
            widths.push(clone.offsetWidth);
        });

        clones.forEach((clone) => {
            clone.parentNode!.removeChild(clone);
        });

        return widths;
    }

    private getElementWidthUsingCanvas(element: JQuery, text: string): number {
        this._context.font = element.css("font-size") + " " + element.css("font-family");
        let metrics = this._context.measureText(text);
        return metrics.width;
    }
}
