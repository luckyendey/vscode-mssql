/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ToolbarButton } from "@fluentui/react-components";
import * as FluentIcons from "@fluentui/react-icons";
import { useContext } from "react";
import { SchemaDesignerContext } from "../schemaDesignerStateProvider";
import { locConstants } from "../../../common/locConstants";
import eventBus from "../schemaDesignerEvents";

export function AddTableButton() {
    const context = useContext(SchemaDesignerContext);
    if (!context) {
        return undefined;
    }

    return (
        <ToolbarButton
            icon={<FluentIcons.TableAdd16Regular />}
            onClick={() => {
                eventBus.emit("newTable", context.extractSchema());
            }}
            title={locConstants.schemaDesigner.addTable}
            appearance="subtle">
            {locConstants.schemaDesigner.addTable}
        </ToolbarButton>
    );
}
