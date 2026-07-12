import { ApolloLink, Observable } from '@apollo/client';
import type { Operation } from '@apollo/client';
import { print } from 'graphql';
import { extractFiles } from './extractFiles';
import type { CreateUploadLinkOptions, FileEntry } from '../../types/graphql';

/**
 * Custom upload link for Apollo Client that handles multipart file uploads.
 * Compatible with Vite and the graphql-multipart-request-spec.
 */
export function createUploadLink(options: CreateUploadLinkOptions): ApolloLink {
  const { uri, headers: defaultHeaders = {}, credentials } = options;

  return new ApolloLink((operation: Operation) => {
    return new Observable((observer) => {
      const { query, variables, operationName } = operation;
      const context = operation.getContext();
      const contextHeaders = context.headers || {};

      const { files, variables: cleanedVariables } = extractFiles(variables);

      const fetchOptions: RequestInit = {
        method: 'POST',
        headers: {
          ...defaultHeaders,
          ...contextHeaders,
        },
        credentials: credentials || 'same-origin',
      };

      let body: BodyInit;

      if (files.size > 0) {
        // Multipart upload - ORDER MATTERS for gqlgen: operations, map, then files
        const formData = new FormData();

        // 1. Operations (query, variables)
        const operations = JSON.stringify({
          query: print(query),
          variables: cleanedVariables,
          operationName,
        });
        formData.append('operations', operations);

        // 2. Build map first (but DON'T append yet)
        const map: Record<string, string[]> = {};
        const fileEntries: FileEntry[] = [];
        let i = 0;
        files.forEach((file: File | Blob, path: string) => {
          const graphqlPath = path.startsWith('variables.') ? path : `variables.${path}`;
          map[i.toString()] = [graphqlPath];
          fileEntries.push({ index: i.toString(), file, path: graphqlPath });
          i++;
        });

        // 3. Append map (second)
        formData.append('map', JSON.stringify(map));

        // 4. Append files last (third)
        fileEntries.forEach(({ index, file }) => {
          formData.append(index, file as Blob, (file as File).name);
        });

        body = formData;
        // Don't set Content-Type, let browser set it with boundary
        delete (fetchOptions.headers as Record<string, string>)['Content-Type'];
      } else {
        // Regular JSON request
        body = JSON.stringify({
          query: print(query),
          variables: cleanedVariables,
          operationName,
        });
        (fetchOptions.headers as Record<string, string>)['Content-Type'] = 'application/json';
      }

      fetchOptions.body = body;

      fetch(uri, fetchOptions)
        .then(async (response) => {
          if (!response.ok) {
            let serverErrorMessage = `Network error: ${response.status}`;

            try {
              const rawBodyText = await response.text();

              try {
                const parsed = JSON.parse(rawBodyText);

                // 👇 FIXED: Safely look into the FIRST item of your errors array list block
                if (parsed.errors && Array.isArray(parsed.errors) && parsed.errors.length > 0) {
                  const targetError = parsed.errors[0];

                  // Extract the field parameter key from the end of the path array (e.g., 'shopId')
                  if (targetError.path && targetError.path.length > 0) {
                    const errorField = targetError.path[targetError.path.length - 1];
                    serverErrorMessage = `${errorField}: ${targetError.message}`; // 🎯 Outputs: "shopId: must be defined"
                  } else {
                    serverErrorMessage = targetError.message || serverErrorMessage;
                  }
                } else if (parsed.message || parsed.error) {
                  serverErrorMessage = parsed.message || parsed.error || serverErrorMessage;
                }
              } catch {
                if (rawBodyText) {
                  serverErrorMessage = rawBodyText;
                }
              }
            } catch (readErr) {
              console.error("Failed to read raw network error body stream:", readErr);
            }

            const networkError = new Error(serverErrorMessage);
            (networkError as any).statusCode = response.status;
            (networkError as any).response = response;

            throw networkError;
          }
          return response.json();
        })
        .then((result) => {
          observer.next(result);
          observer.complete();
        })
        .catch((error) => {
          observer.error(error);
        });
    });
  });
}
