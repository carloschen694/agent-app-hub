export type ToolHandler = (args: any) => Promise<any> | any;
export type ToolHandlerMap = Record<string, ToolHandler>;

export async function executeTool(
  name: string,
  args: any,
  handlers: ToolHandlerMap
): Promise<any> {
  const handler = handlers[name];
  if (!handler) {
    return { error: `Tool ${name} has no registered handler.` };
  }

  try {
    return await handler(args);
  } catch (error) {
    console.error(`Error executing tool handler for ${name}`, error);
    return { error: String(error) };
  }
}
