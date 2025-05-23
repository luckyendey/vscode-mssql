/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as React from "react";
import { FixedSizeList as List, ListChildComponentProps } from "react-window";
import {
    useScrollbarWidth,
    useFluent,
    TableBody,
    TableCell,
    TableRow,
    Table,
    TableHeader,
    TableHeaderCell,
    createTableColumn,
    useTableFeatures,
    useTableSelection,
    TableRowData as RowStateBase,
    TableColumnDefinition,
    Checkbox,
    makeStyles,
    Spinner,
} from "@fluentui/react-components";
import { SchemaUpdateAction } from "../../../../sharedInterfaces/schemaCompare";
import { locConstants as loc } from "../../../common/locConstants";
import { DiffEntry } from "vscode-mssql";
import { schemaCompareContext } from "../SchemaCompareStateProvider";
import { useResizable } from "../../../hooks/useResizable";

const useStyles = makeStyles({
    HeaderCellPadding: {
        padding: "0 8px",
    },
    selectedRow: {
        backgroundColor: "var(--vscode-list-activeSelectionBackground)",
        color: "var(--vscode-list-activeSelectionForeground)",
        "& td": {
            backgroundColor: "var(--vscode-list-activeSelectionBackground)",
            color: "var(--vscode-list-activeSelectionForeground)",
        },
    },
    resizableContainer: {
        position: "relative",
        width: "100%",
        overflow: "hidden",
    },
    resizer: {
        position: "absolute",
        bottom: 0,
        left: 0,
        width: "100%",
        height: "8px",
        cursor: "ns-resize",
        backgroundColor: "transparent",
        zIndex: 10,
        "&:hover": {
            backgroundColor: "var(--vscode-scrollbarSlider-hoverBackground)",
            opacity: 0.5,
        },
        "&:active": {
            backgroundColor: "var(--vscode-scrollbarSlider-activeBackground)",
            opacity: 0.7,
        },
    },
    resizerHandle: {
        height: "3px",
        width: "40px",
        margin: "2px auto",
        borderRadius: "1px",
        backgroundColor: "var(--vscode-scrollbarSlider-background)",
        opacity: 0.5,
    },
});

interface TableRowData extends RowStateBase<DiffEntry> {
    onClick: (e: React.MouseEvent) => void;
    onKeyDown: (e: React.KeyboardEvent) => void;
    selected: boolean;
    appearance: "brand" | "none";
}

interface ReactWindowRenderFnProps extends ListChildComponentProps {
    data: TableRowData[];
}

interface Props {
    onDiffSelected: (id: number) => void;
    selectedDiffId: number;
    siblingRef?: React.RefObject<HTMLDivElement>;
}

export const SchemaDifferences = React.forwardRef<HTMLDivElement, Props>(
    ({ onDiffSelected, selectedDiffId, siblingRef }, ref) => {
        const classes = useStyles();
        const { targetDocument } = useFluent();
        const scrollbarWidth = useScrollbarWidth({ targetDocument });
        const context = React.useContext(schemaCompareContext);
        const compareResult = context.state.schemaCompareResult;
        const [diffInclusionLevel, setDiffInclusionLevel] = React.useState<
            "allIncluded" | "allExcluded" | "mixed"
        >("allIncluded");

        // Use the resizable hook
        const {
            ref: resizableRef,
            height,
            resizerProps,
        } = useResizable({
            initialHeight: 300,
            minHeight: 150,
            maxHeight: 800,
            siblingRef,
        });

        // Add a reference to the List component
        const listRef = React.useRef<List>(null);

        // Use an effect to scroll to the selected row when selectedDiffId changes
        React.useEffect(() => {
            if (selectedDiffId >= 0 && listRef.current) {
                listRef.current.scrollToItem(selectedDiffId, "center");
            }
        }, [selectedDiffId]);

        // Expose resizableRef via forwarded ref
        React.useImperativeHandle(ref, () => resizableRef.current!);

        React.useEffect(() => {
            let allIncluded = true;
            let allExcluded = true;
            let someIncluded = false;
            for (const diffEntry of compareResult.differences) {
                if (!diffEntry.included) {
                    allIncluded = false;
                }

                if (diffEntry.included) {
                    allExcluded = false;
                }
            }

            if (!allIncluded && !allExcluded) {
                someIncluded = true;
            }

            if (someIncluded) {
                setDiffInclusionLevel("mixed");
            } else if (allIncluded) {
                setDiffInclusionLevel("allIncluded");
            } else {
                setDiffInclusionLevel("allExcluded");
            }
        }, [context.state.schemaCompareResult]);

        const formatName = (nameParts: string[]): string => {
            if (!nameParts || nameParts.length === 0) {
                return "";
            }

            return nameParts.join(".");
        };

        const handleIncludeExcludeNode = (diffEntry: DiffEntry, include: boolean) => {
            if (diffEntry.position !== undefined) {
                context.includeExcludeNode(diffEntry.position, diffEntry, include);
            }
        };

        const handleIncludeExcludeAllNodes = () => {
            if (diffInclusionLevel === "allExcluded" || diffInclusionLevel === "mixed") {
                context.includeExcludeAllNodes(true /* include all */);
            } else {
                context.includeExcludeAllNodes(false /* exclude all */);
            }
        };

        const getLabelForAction = (action: SchemaUpdateAction): string => {
            let actionLabel = "";
            switch (action) {
                case SchemaUpdateAction.Add:
                    actionLabel = loc.schemaCompare.add;
                    break;
                case SchemaUpdateAction.Change:
                    actionLabel = loc.schemaCompare.change;
                    break;
                case SchemaUpdateAction.Delete:
                    actionLabel = loc.schemaCompare.delete;
                    break;
            }

            return actionLabel;
        };

        const columns: TableColumnDefinition<DiffEntry>[] = [
            createTableColumn<DiffEntry>({
                columnId: "type",
                renderCell: (item) => {
                    return <TableCell>{item.name}</TableCell>;
                },
            }),
            createTableColumn<DiffEntry>({
                columnId: "sourceName",
                renderCell: (item) => {
                    return <TableCell>{formatName(item.sourceValue)}</TableCell>;
                },
            }),
            createTableColumn<DiffEntry>({
                columnId: "include",
                renderCell: (item) => {
                    return (
                        <TableCell>
                            <Checkbox
                                checked={item.included}
                                onClick={() => handleIncludeExcludeNode(item, !item.included)}
                            />
                        </TableCell>
                    );
                },
            }),
            createTableColumn<DiffEntry>({
                columnId: "action",
                renderCell: (item) => {
                    return <TableCell>{getLabelForAction(item.updateAction as number)}</TableCell>;
                },
            }),
            createTableColumn<DiffEntry>({
                columnId: "targetName",
                renderCell: (item) => {
                    return <TableCell>{formatName(item.targetValue)}</TableCell>;
                },
            }),
        ];

        let items: DiffEntry[] = [];
        if (compareResult?.success) {
            items = compareResult.differences.map(
                (item, index) =>
                    ({
                        position: index,
                        ...item,
                    }) as DiffEntry,
            );
        }

        const {
            getRows,
            selection: { toggleRow },
        } = useTableFeatures(
            {
                columns,
                items,
            },
            [
                useTableSelection({
                    selectionMode: "multiselect",
                }),
            ],
        );

        const rows: TableRowData[] = getRows((row) => {
            const selected = row.item.included;
            return {
                ...row,
                onClick: (e: React.MouseEvent) => toggleRow(e, row.rowId),
                onKeyDown: (e: React.KeyboardEvent) => {
                    if (e.key === " ") {
                        e.preventDefault();
                        toggleRow(e, row.rowId);
                    }
                },
                selected,
                appearance: selected ? ("brand" as const) : ("none" as const),
            };
        });

        const toggleAllKeydown = (e: React.KeyboardEvent<HTMLDivElement>) => {
            if (e.key === " ") {
                handleIncludeExcludeAllNodes();
                e.preventDefault();
            }
        };

        const toggleKeyDown = (
            e: React.KeyboardEvent<HTMLDivElement>,
            diffEntry: DiffEntry,
            include: boolean,
        ) => {
            if (e.key === "Enter") {
                if (diffEntry.position !== undefined) {
                    onDiffSelected(diffEntry.position);
                }
                e.preventDefault();
            }
            if (e.key === " ") {
                handleIncludeExcludeNode(diffEntry, include);
                e.preventDefault();
            }
        };

        const RenderRow = ({ index, style, data }: ReactWindowRenderFnProps) => {
            const { item, appearance, onKeyDown } = data[index];
            return (
                <TableRow
                    aria-rowindex={index + 2}
                    style={style}
                    key={item.position}
                    onKeyDown={onKeyDown}
                    onClick={() => onDiffSelected(index)}
                    appearance={appearance}
                    className={index === selectedDiffId ? classes.selectedRow : undefined}>
                    <TableCell>{item.name}</TableCell>
                    <TableCell>{formatName(item.sourceValue)}</TableCell>
                    <TableCell>
                        <Checkbox
                            checked={item.included}
                            onClick={() => handleIncludeExcludeNode(item, !item.included)}
                            onKeyDown={(e) => toggleKeyDown(e, item, !item.included)}
                            disabled={context.state.isIncludeExcludeAllOperationInProgress}
                        />
                    </TableCell>
                    <TableCell>{getLabelForAction(item.updateAction as number)}</TableCell>
                    <TableCell>{formatName(item.targetValue)}</TableCell>
                </TableRow>
            );
        };

        return (
            <div
                className={classes.resizableContainer}
                ref={resizableRef}
                style={{ height: `${height}px` }}>
                <Table
                    noNativeElements
                    aria-label="Table with selection"
                    aria-rowcount={rows.length}
                    style={{ minWidth: "650px" }}>
                    <TableHeader>
                        <TableRow aria-rowindex={1}>
                            <TableHeaderCell className={classes.HeaderCellPadding}>
                                {loc.schemaCompare.type}
                            </TableHeaderCell>
                            <TableHeaderCell className={classes.HeaderCellPadding}>
                                {loc.schemaCompare.sourceName}
                            </TableHeaderCell>
                            <TableHeaderCell>
                                {!context.state.isIncludeExcludeAllOperationInProgress && (
                                    <Checkbox
                                        checked={
                                            diffInclusionLevel === "allIncluded"
                                                ? true
                                                : diffInclusionLevel === "mixed"
                                                  ? "mixed"
                                                  : false
                                        }
                                        onClick={() => handleIncludeExcludeAllNodes()}
                                        onKeyDown={toggleAllKeydown}
                                    />
                                )}
                                {context.state.isIncludeExcludeAllOperationInProgress && (
                                    <Spinner
                                        size="extra-tiny"
                                        aria-label={
                                            loc.schemaCompare.includeExcludeAllOperationInProgress
                                        }
                                    />
                                )}
                            </TableHeaderCell>
                            <TableHeaderCell className={classes.HeaderCellPadding}>
                                {loc.schemaCompare.action}
                            </TableHeaderCell>
                            <TableHeaderCell className={classes.HeaderCellPadding}>
                                {loc.schemaCompare.targetName}
                            </TableHeaderCell>
                            {/** Scrollbar alignment for the header */}
                            <div role="presentation" style={{ width: scrollbarWidth }} />
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        <List
                            ref={listRef}
                            height={height - 40} // Subtract header height
                            itemCount={items.length}
                            itemSize={45}
                            width={"100%"}
                            itemData={rows}>
                            {RenderRow}
                        </List>
                    </TableBody>
                </Table>
                <div {...resizerProps} className={classes.resizer}>
                    <div className={classes.resizerHandle} />
                </div>
            </div>
        );
    },
);

export default SchemaDifferences;
