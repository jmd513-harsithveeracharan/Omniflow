# Microsoft Fabric Complete Official REST API Catalog

Harvested directly from official Microsoft specs repository (`microsoft/fabric-rest-api-specs`).

- **Total Modules / Workloads:** 61
- **Total Granular REST Endpoints:** 729

## Workloads & Services Discovered

- `admin`
- `admin_definitions.json`
- `admin_definitions_domains.json`
- `admin_definitions_externaldatasharing.json`
- `admin_definitions_sharinglinks.json`
- `admin_definitions_tags.json`
- `anomalyDetector`
- `apacheAirflowJob`
- `appBackend`
- `azureDatabricksStorage`
- `common`
- `copyJob`
- `cosmosDbDatabase`
- `dashboard`
- `dataAgent`
- `dataBuildToolJob`
- `dataPipeline`
- `dataflow`
- `datamart`
- `digitalTwinBuilder`
- `digitalTwinBuilderFlow`
- `environment`
- `eventSchemaSet`
- `eventhouse`
- `eventstream`
- `graphModel`
- `graphQLApi`
- `graphQuerySet`
- `kqlDashboard`
- `kqlDatabase`
- `kqlQueryset`
- `lakehouse`
- `map`
- `mirroredAzureDatabricksCatalog`
- `mirroredCatalog`
- `mirroredDatabase`
- `mirroredWarehouse`
- `mlExperiment`
- `mlModel`
- `mountedDataFactory`
- `notebook`
- `ontology`
- `operationsAgent`
- `orgApp`
- `orgAppAudience`
- `paginatedReport`
- `plan`
- `platform`
- `realTimeIntelligence`
- `reflex`
- `report`
- `semanticModel`
- `snowflakeDatabase`
- `spark`
- `sparkjobdefinition`
- `sqlDatabase`
- `sqlEndpoint`
- `userDataFunction`
- `variableLibrary`
- `warehouse`
- `warehouseSnapshot`

## All Endpoints

| Workload / Module | Item / Feature | Method | Endpoint Path | Operation ID | Summary |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `admin` | Domains | **DELETE** | `/domains/{domainId}` | `Domains_DeleteDomain` | Deletes the specified domain. |
| `admin` | Domains | **POST** | `/domains/{domainId}/assignWorkspaces` | `Domains_AssignDomainWorkspacesByIds` | Assign workspaces to the specified domain by workspace ID. |
| `admin` | Domains | **POST** | `/domains/{domainId}/assignWorkspacesByCapacities` | `Domains_AssignDomainWorkspacesByCapacities` | Assign all workspaces that reside on the specified capacities to the specified domain. |
| `admin` | Domains | **POST** | `/domains/{domainId}/assignWorkspacesByPrincipals` | `Domains_AssignDomainWorkspacesByPrincipals` | Assign workspaces to the specified domain, when one of the specified principals has admin permission |
| `admin` | Domains | **GET** | `/domains/{domainId}/roleAssignments` | `Domains_ListRoleAssignments` | Returns a list of domain role assignments. |
| `admin` | Domains | **POST** | `/domains/{domainId}/roleAssignments/bulkAssign` | `Domains_RoleAssignmentsBulkAssign` | Assign the specified admins or contributors to the domain. |
| `admin` | Domains | **POST** | `/domains/{domainId}/roleAssignments/bulkUnassign` | `Domains_RoleAssignmentsBulkUnassign` | Unassign the specified admins or contributors from the domain. |
| `admin` | Domains | **POST** | `/domains/{domainId}/roleAssignments/syncToSubdomains` | `Domains_SyncRoleAssignmentsToSubdomains` | Sync the role assignments from the specified domain to its subdomains. |
| `admin` | Domains | **POST** | `/domains/{domainId}/unassignAllWorkspaces` | `Domains_UnassignAllDomainWorkspaces` | Unassign all workspaces from the specified domain. |
| `admin` | Domains | **POST** | `/domains/{domainId}/unassignWorkspaces` | `Domains_UnassignDomainWorkspacesByIds` | Unassign workspaces from the specified domain by workspace ID. |
| `admin` | Domains | **GET** | `/domains/{domainId}/workspaces` | `Domains_ListDomainWorkspaces` | Returns a list of the workspaces assigned to the specified domain. |
| `admin` | Domains | **GET** | `/domains/{domainId}?preview=false` | `Domains_GetDomain` | Returns the specified domain info. |
| `admin` | Domains | **PATCH** | `/domains/{domainId}?preview=false` | `Domains_UpdateDomain` | Updates the specified domain info. |
| `admin` | Domains | **GET** | `/domains/{domainId}?preview=true` | `Domains_Get_Domain_(preview)` | Returns the specified domain info (preview). |
| `admin` | Domains | **PATCH** | `/domains/{domainId}?preview=true` | `Domains_Update_Domain_(preview)` | Updates the specified domain info (preview). |
| `admin` | Domains | **GET** | `/domains?preview=false` | `Domains_ListDomains` | Returns info for all domains. |
| `admin` | Domains | **POST** | `/domains?preview=false` | `Domains_CreateDomain` | Creates a new domain. |
| `admin` | Domains | **GET** | `/domains?preview=true` | `Domains_List_Domains_(preview)` | Returns info for all domains (preview). |
| `admin` | Domains | **POST** | `/domains?preview=true` | `Domains_Create_Domain_(preview)` | Creates a new domain (preview). |
| `admin` | ExternalDataSharesProvider | **GET** | `/items/externalDataShares` | `ExternalDataSharesProvider_ListExternalDataShares` | Lists the external data shares in the tenant. |
| `admin` | ExternalDataSharesProvider | **POST** | `/workspaces/{workspaceId}/items/{itemId}/externalDataShares/{externalDataShareId}/revoke` | `ExternalDataSharesProvider_RevokeExternalDataShare` | Revokes the specified external data share. This action cannot be undone. |
| `admin` | Items | **GET** | `/items` | `Items_ListItems` | Returns a list of active Fabric and PowerBI items. |
| `admin` | Items | **GET** | `/workspaces/{workspaceId}/items/{itemId}` | `Items_GetItem` | Returns the specified Fabric or PowerBI item. |
| `admin` | Items | **GET** | `/workspaces/{workspaceId}/items/{itemId}/users` | `Items_ListItemAccessDetails` | Returns a list of users (including groups and service principals) and lists their workspace roles. |
| `admin` | Labels | **POST** | `/items/bulkRemoveLabels` | `Labels_BulkRemoveLabels` | Remove sensitivity labels from Fabric items (such as lakehouses and reports) by item ID. The sensiti |
| `admin` | Labels | **POST** | `/items/bulkSetLabels` | `Labels_BulkSetLabels` | Set sensitivity labels on Fabric items, such as lakehouses and reports, by item ID. The sensitivity  |
| `admin` | SharingLinks | **POST** | `/items/bulkRemoveSharingLinks` | `SharingLinks_BulkRemoveSharingLinks` | Deletes all organization sharing links for the specified Fabric items. This action cannot be undone. |
| `admin` | SharingLinks | **POST** | `/items/removeAllSharingLinks` | `SharingLinks_RemoveAllSharingLinks` | Deletes all organization sharing links for all Fabric items in the tenant. This action cannot be und |
| `admin` | Tags | **GET** | `/tags` | `Tags_ListTags` | Returns a list of all the tenant's tags. |
| `admin` | Tags | **POST** | `/tags/bulkCreateTags` | `Tags_BulkCreateTags` | Create new tags. |
| `admin` | Tags | **DELETE** | `/tags/{tagId}` | `Tags_DeleteTag` | Delete the specified tag. |
| `admin` | Tags | **PATCH** | `/tags/{tagId}` | `Tags_UpdateTag` | Updates the specified tag. |
| `admin` | Tenants | **GET** | `/capacities/delegatedTenantSettingOverrides` | `Tenants_ListCapacitiesTenantSettingsOverrides` | Returns list of tenant setting overrides that override at the capacities. |
| `admin` | Tenants | **GET** | `/capacities/{capacityId}/delegatedTenantSettingOverrides` | `Tenants_ListCapacityTenantSettingsOverridesByCapacityId` | Returns list of tenant setting overrides that override for given capacity Id. |
| `admin` | Tenants | **DELETE** | `/capacities/{capacityId}/delegatedTenantSettingOverrides/{tenantSettingName}` | `Tenants_DeleteCapacityTenantSettingOverride` | Remove given tenant setting override for given capacity Id. |
| `admin` | Tenants | **POST** | `/capacities/{capacityId}/delegatedTenantSettingOverrides/{tenantSettingName}/update` | `Tenants_UpdateCapacityTenantSettingOverride` | Update given tenant setting override for given capacity Id. |
| `admin` | Tenants | **GET** | `/domains/delegatedTenantSettingOverrides` | `Tenants_ListDomainsTenantSettingsOverrides` | Returns list of domain delegation setting overrides. |
| `admin` | Tenants | **GET** | `/tenantsettings` | `Tenants_ListTenantSettings` | Returns a list of the tenant settings. |
| `admin` | Tenants | **POST** | `/tenantsettings/{tenantSettingName}/update` | `Tenants_UpdateTenantSetting` | Update a given tenant setting. |
| `admin` | Tenants | **GET** | `/workspaces/delegatedTenantSettingOverrides` | `Tenants_ListWorkspacesTenantSettingsOverrides` | Returns list of workspace delegation setting overrides. |
| `admin` | Users | **GET** | `/users/{userId}/access` | `Users_ListAccessEntities` | Returns a list of permission details for Fabric and PowerBI items the specified user can access. |
| `admin` | Workloads | **GET** | `/workloads` | `Workloads_ListWorkloads` | Returns all workloads, optionally filtered by assignment status. If AssignmentStatus is not specifie |
| `admin` | Workloads | **GET** | `/workloads/assignments` | `Workloads_ListWorkloadAssignments` | List all workload assignments. The result contains a list of assignments which can be filtered by th |
| `admin` | Workloads | **POST** | `/workloads/assignments` | `Workloads_CreateWorkloadAssignment` | Create workload assignment. |
| `admin` | Workloads | **DELETE** | `/workloads/assignments/{assignmentId}` | `Workloads_DeleteWorkloadAssignment` | Delete workload assignment. |
| `admin` | Workspaces | **GET** | `/workspaces` | `Workspaces_ListWorkspaces` | Returns a list of workspaces. |
| `admin` | Workspaces | **GET** | `/workspaces/discoverGitConnections` | `Workspaces_ListGitConnections` | Returns a list of Git connections. |
| `admin` | Workspaces | **GET** | `/workspaces/networking/communicationpolicies` | `Workspaces_ListNetworkingCommunicationPolicies` | Returns network communication policy settings for all workspaces in the tenant. |
| `admin` | Workspaces | **GET** | `/workspaces/{workspaceId}` | `Workspaces_GetWorkspace` | Returns the specified workspace. |
| `admin` | Workspaces | **POST** | `/workspaces/{workspaceId}/grantAdminTemporaryAccess` | `Workspaces_GrantAdminTemporaryAccess` | Grants admin temporary (24h) access to a user's 'My Workspace'. |
| `admin` | Workspaces | **POST** | `/workspaces/{workspaceId}/removeAdminTemporaryAccess` | `Workspaces_RemoveAdminTemporaryAccess` | Removes admin temporary access from a user's 'My Workspace'. |
| `admin` | Workspaces | **POST** | `/workspaces/{workspaceId}/restore` | `Workspaces_RestoreWorkspace` | Restores a deleted workspace. |
| `admin` | Workspaces | **GET** | `/workspaces/{workspaceId}/users` | `Workspaces_ListWorkspaceAccessDetails` | Returns a list of users (including groups and ServicePrincipals) that have access to the specified w |
| `anomalyDetector` | Items | **GET** | `/workspaces/{workspaceId}/anomalyDetectors` | `Items_ListAnomalyDetectors` | Returns a list of AnomalyDetectors from the specified workspace. |
| `anomalyDetector` | Items | **POST** | `/workspaces/{workspaceId}/anomalyDetectors` | `Items_CreateAnomalyDetector` | Creates a AnomalyDetector in the specified workspace. |
| `anomalyDetector` | Items | **GET** | `/workspaces/{workspaceId}/anomalyDetectors/{anomalyDetectorId}` | `Items_GetAnomalyDetector` | Returns properties of the specified AnomalyDetector. |
| `anomalyDetector` | Items | **PATCH** | `/workspaces/{workspaceId}/anomalyDetectors/{anomalyDetectorId}` | `Items_UpdateAnomalyDetector` | Updates the properties of the specified AnomalyDetector. |
| `anomalyDetector` | Items | **DELETE** | `/workspaces/{workspaceId}/anomalyDetectors/{anomalyDetectorId}` | `Items_DeleteAnomalyDetector` | Deletes the specified AnomalyDetector. |
| `anomalyDetector` | Items | **POST** | `/workspaces/{workspaceId}/anomalyDetectors/{anomalyDetectorId}/getDefinition` | `Items_GetAnomalyDetectorDefinition` | Returns the specified AnomalyDetector definition. |
| `anomalyDetector` | Items | **POST** | `/workspaces/{workspaceId}/anomalyDetectors/{anomalyDetectorId}/updateDefinition` | `Items_UpdateAnomalyDetectorDefinition` | Overrides the definition for the specified AnomalyDetector. |
| `apacheAirflowJob` | Compute | **GET** | `/workspaces/{workspaceId}/apacheAirflowJobs/{apacheAirflowJobId}/environment/compute?beta=true` | `Compute_Get_Apache_Airflow_Job_Compute_(beta)` | Returns the compute configuration for the specified Apache Airflow job environment. |
| `apacheAirflowJob` | Compute | **POST** | `/workspaces/{workspaceId}/apacheAirflowJobs/{apacheAirflowJobId}/environment/updateCompute?beta=true` | `Compute_Update_Apache_Airflow_Job_Compute_(beta)` | Updates the compute configuration for an Apache Airflow job environment. |
| `apacheAirflowJob` | Environment | **POST** | `/workspaces/{workspaceId}/apacheAirflowJobs/{apacheAirflowJobId}/environment/start?beta=true` | `Environment_Start_Apache_Airflow_Job_Environment_(beta)` | Starts an Apache Airflow job environment. |
| `apacheAirflowJob` | Environment | **POST** | `/workspaces/{workspaceId}/apacheAirflowJobs/{apacheAirflowJobId}/environment/stop?beta=true` | `Environment_Stop_Apache_Airflow_Job_Environment_(beta)` | Stops an Apache Airflow job environment. |
| `apacheAirflowJob` | Environment | **GET** | `/workspaces/{workspaceId}/apacheAirflowJobs/{apacheAirflowJobId}/environment?beta=true` | `Environment_Get_Apache_Airflow_Job_Environment_(beta)` | Gets the Apache Airflow environment for the specified Apache Airflow job. |
| `apacheAirflowJob` | Files | **GET** | `/workspaces/{workspaceId}/apacheAirflowJobs/{apacheAirflowJobId}/files/{filePath}?beta=true` | `Files_Get_Apache_Airflow_Job_File_(beta)` | Returns the specified Apache Airflow job file. |
| `apacheAirflowJob` | Files | **PUT** | `/workspaces/{workspaceId}/apacheAirflowJobs/{apacheAirflowJobId}/files/{filePath}?beta=true` | `Files_Create_Or_Update_Apache_Airflow_Job_File_(beta)` | Creates or updates an Apache Airflow job file. |
| `apacheAirflowJob` | Files | **DELETE** | `/workspaces/{workspaceId}/apacheAirflowJobs/{apacheAirflowJobId}/files/{filePath}?beta=true` | `Files_Delete_Apache_Airflow_Job_File_(beta)` | Deletes the specified Apache Airflow job file. |
| `apacheAirflowJob` | Files | **GET** | `/workspaces/{workspaceId}/apacheAirflowJobs/{apacheAirflowJobId}/files?beta=true` | `Files_List_Apache_Airflow_Job_Files_(beta)` | Returns a list of Apache Airflow job files from the specified Apache Airflow job. |
| `apacheAirflowJob` | Items | **GET** | `/workspaces/{workspaceId}/apacheAirflowJobs` | `Items_ListApacheAirflowJobs` | Returns a list of Apache Airflow jobs from the specified workspace. |
| `apacheAirflowJob` | Items | **POST** | `/workspaces/{workspaceId}/apacheAirflowJobs` | `Items_CreateApacheAirflowJob` | Creates an Apache Airflow job in the specified workspace. |
| `apacheAirflowJob` | Items | **GET** | `/workspaces/{workspaceId}/apacheAirflowJobs/{apacheAirflowJobId}` | `Items_GetApacheAirflowJob` | Returns properties of the specified Apache Airflow job. |
| `apacheAirflowJob` | Items | **PATCH** | `/workspaces/{workspaceId}/apacheAirflowJobs/{apacheAirflowJobId}` | `Items_UpdateApacheAirflowJob` | Updates the properties of the specified Apache Airflow job. |
| `apacheAirflowJob` | Items | **DELETE** | `/workspaces/{workspaceId}/apacheAirflowJobs/{apacheAirflowJobId}` | `Items_DeleteApacheAirflowJob` | Deletes the specified Apache Airflow job. |
| `apacheAirflowJob` | Items | **POST** | `/workspaces/{workspaceId}/apacheAirflowJobs/{apacheAirflowJobId}/getDefinition` | `Items_GetApacheAirflowJobDefinition` | Returns the specified Apache Airflow job public definition. |
| `apacheAirflowJob` | Items | **POST** | `/workspaces/{workspaceId}/apacheAirflowJobs/{apacheAirflowJobId}/updateDefinition` | `Items_UpdateApacheAirflowJobDefinition` | Overrides the definition for the specified Apache Airflow job. |
| `apacheAirflowJob` | PoolManagement | **GET** | `/workspaces/{workspaceId}/apacheAirflowJobs/poolTemplates/{poolTemplateId}?beta=true` | `PoolManagement_Get_Airflow_Pool_Template_(beta)` | Get an Apache Airflow pool template. |
| `apacheAirflowJob` | PoolManagement | **DELETE** | `/workspaces/{workspaceId}/apacheAirflowJobs/poolTemplates/{poolTemplateId}?beta=true` | `PoolManagement_Delete_Airflow_Pool_Template_(beta)` | Delete an Apache Airflow pool template. |
| `apacheAirflowJob` | PoolManagement | **GET** | `/workspaces/{workspaceId}/apacheAirflowJobs/poolTemplates?beta=true` | `PoolManagement_List_Airflow_Pool_Templates_(beta)` | List Apache Airflow pool templates. |
| `apacheAirflowJob` | PoolManagement | **POST** | `/workspaces/{workspaceId}/apacheAirflowJobs/poolTemplates?beta=true` | `PoolManagement_Create_Airflow_Pool_Template_(beta)` | Create an Apache Airflow pool template. |
| `apacheAirflowJob` | Requirements | **POST** | `/workspaces/{workspaceId}/apacheAirflowJobs/{apacheAirflowJobId}/environment/deployRequirements?beta=true` | `Requirements_Deploy_Apache_Airflow_Job_Requirements_(beta)` | Deploys requirements for an Apache Airflow job environment. |
| `apacheAirflowJob` | Requirements | **GET** | `/workspaces/{workspaceId}/apacheAirflowJobs/{apacheAirflowJobId}/environment/libraries?beta=true` | `Requirements_List_Apache_Airflow_Job_Libraries_(beta)` | Returns a list of installed libraries for the specified Apache Airflow job environment. |
| `apacheAirflowJob` | Settings | **GET** | `/workspaces/{workspaceId}/apacheAirflowJobs/{apacheAirflowJobId}/environment/settings?beta=true` | `Settings_Get_Apache_Airflow_Job_Settings_(beta)` | Returns the environment settings for the specified Apache Airflow job. |
| `apacheAirflowJob` | Settings | **POST** | `/workspaces/{workspaceId}/apacheAirflowJobs/{apacheAirflowJobId}/environment/updateSettings?beta=true` | `Settings_Update_Apache_Airflow_Job_Settings_(beta)` | Updates the settings for an Apache Airflow job environment. |
| `apacheAirflowJob` | WorkspaceSettings | **GET** | `/workspaces/{workspaceId}/apacheAirflowJobs/settings?beta=true` | `WorkspaceSettings_Get_Airflow_Workspace_Settings_(beta)` | Get Apache Airflow workspace settings. |
| `apacheAirflowJob` | WorkspaceSettings | **PATCH** | `/workspaces/{workspaceId}/apacheAirflowJobs/settings?beta=true` | `WorkspaceSettings_Update_Airflow_Workspace_Settings_(beta)` | Update Apache Airflow workspace settings. |
| `appBackend` | Items | **GET** | `/workspaces/{workspaceId}/appBackends` | `Items_ListAppBackends` | List AppBackends in the specified workspace. |
| `appBackend` | Items | **POST** | `/workspaces/{workspaceId}/appBackends` | `Items_CreateAppBackend` | Create an AppBackend in the specified workspace. |
| `appBackend` | Items | **GET** | `/workspaces/{workspaceId}/appBackends/{appBackendId}` | `Items_GetAppBackend` | Get the specified AppBackend. |
| `appBackend` | Items | **PATCH** | `/workspaces/{workspaceId}/appBackends/{appBackendId}` | `Items_UpdateAppBackend` | Update the specified AppBackend. |
| `appBackend` | Items | **DELETE** | `/workspaces/{workspaceId}/appBackends/{appBackendId}` | `Items_DeleteAppBackend` | Delete the specified AppBackend. |
| `azureDatabricksStorage` | Items | **GET** | `/workspaces/{workspaceId}/azureDatabricksStorages` | `Items_ListAzureDatabricksStorages` | Returns a list of Azure Databricks storage items from the specified workspace. |
| `azureDatabricksStorage` | Items | **POST** | `/workspaces/{workspaceId}/azureDatabricksStorages` | `Items_CreateAzureDatabricksStorage` | Creates an AzureDatabricksStorage in the specified workspace. |
| `azureDatabricksStorage` | Items | **GET** | `/workspaces/{workspaceId}/azureDatabricksStorages/{azureDatabricksStorageId}` | `Items_GetAzureDatabricksStorage` | Returns the properties of the specified AzureDatabricksStorage. |
| `azureDatabricksStorage` | Items | **PATCH** | `/workspaces/{workspaceId}/azureDatabricksStorages/{azureDatabricksStorageId}` | `Items_UpdateAzureDatabricksStorage` | Updates the properties of the specified AzureDatabricksStorage. |
| `azureDatabricksStorage` | Items | **DELETE** | `/workspaces/{workspaceId}/azureDatabricksStorages/{azureDatabricksStorageId}` | `Items_DeleteAzureDatabricksStorage` | Deletes the specified AzureDatabricksStorage. |
| `azureDatabricksStorage` | Items | **POST** | `/workspaces/{workspaceId}/azureDatabricksStorages/{azureDatabricksStorageId}/getDefinition` | `Items_GetAzureDatabricksStorageDefinition` | Returns the specified AzureDatabricksStorage public definition. |
| `azureDatabricksStorage` | Items | **POST** | `/workspaces/{workspaceId}/azureDatabricksStorages/{azureDatabricksStorageId}/updateDefinition` | `Items_UpdateAzureDatabricksStorageDefinition` | Overrides the definition for the specified AzureDatabricksStorage. |
| `copyJob` | Items | **GET** | `/workspaces/{workspaceId}/copyJobs` | `Items_ListCopyJobs` | Returns a list of CopyJobs from the specified workspace. |
| `copyJob` | Items | **POST** | `/workspaces/{workspaceId}/copyJobs` | `Items_CreateCopyJob` | Creates a CopyJob in the specified workspace. |
| `copyJob` | Items | **GET** | `/workspaces/{workspaceId}/copyJobs/{copyJobId}` | `Items_GetCopyJob` | Returns properties of the specified CopyJob. |
| `copyJob` | Items | **PATCH** | `/workspaces/{workspaceId}/copyJobs/{copyJobId}` | `Items_UpdateCopyJob` | Updates the properties of the specified CopyJob. |
| `copyJob` | Items | **DELETE** | `/workspaces/{workspaceId}/copyJobs/{copyJobId}` | `Items_DeleteCopyJob` | Deletes the specified CopyJob. |
| `copyJob` | Items | **POST** | `/workspaces/{workspaceId}/copyJobs/{copyJobId}/getDefinition` | `Items_GetCopyJobDefinition` | Returns the specified CopyJob public definition. |
| `copyJob` | Items | **POST** | `/workspaces/{workspaceId}/copyJobs/{copyJobId}/resetCopyJob` | `Items_ResetCopyJob` | Resets the specified CopyJob. |
| `copyJob` | Items | **POST** | `/workspaces/{workspaceId}/copyJobs/{copyJobId}/updateDefinition` | `Items_UpdateCopyJobDefinition` | Overrides the definition for the specified CopyJob. |
| `cosmosDbDatabase` | Items | **GET** | `/workspaces/{workspaceId}/cosmosDbDatabases` | `Items_ListCosmosDBDatabases` | Returns a list of Cosmos DB databases from the specified workspace. |
| `cosmosDbDatabase` | Items | **POST** | `/workspaces/{workspaceId}/cosmosDbDatabases` | `Items_CreateCosmosDBDatabase` | Creates a Cosmos DB database in the specified workspace. |
| `cosmosDbDatabase` | Items | **GET** | `/workspaces/{workspaceId}/cosmosDbDatabases/{cosmosDbDatabaseId}` | `Items_GetCosmosDBDatabase` | Returns properties of the specified Cosmos DB database. |
| `cosmosDbDatabase` | Items | **PATCH** | `/workspaces/{workspaceId}/cosmosDbDatabases/{cosmosDbDatabaseId}` | `Items_UpdateCosmosDBDatabase` | Updates the properties of the specified Cosmos DB database. |
| `cosmosDbDatabase` | Items | **DELETE** | `/workspaces/{workspaceId}/cosmosDbDatabases/{cosmosDbDatabaseId}` | `Items_DeleteCosmosDBDatabase` | Deletes the specified Cosmos DB database. |
| `cosmosDbDatabase` | Items | **POST** | `/workspaces/{workspaceId}/cosmosDbDatabases/{cosmosDbDatabaseId}/getDefinition` | `Items_GetCosmosDBDatabaseDefinition` | Returns the specified Cosmos DB database public definition. |
| `cosmosDbDatabase` | Items | **POST** | `/workspaces/{workspaceId}/cosmosDbDatabases/{cosmosDbDatabaseId}/updateDefinition` | `Items_UpdateCosmosDBDatabaseDefinition` | Overrides the definition for the specified Cosmos DB database. |
| `dashboard` | Items | **GET** | `/workspaces/{workspaceId}/dashboards` | `Items_ListDashboards` | Returns a list of dashboards from the specified workspace. |
| `dataAgent` | Items | **GET** | `/workspaces/{workspaceId}/dataAgents` | `Items_ListDataAgents` | Returns a list of DataAgents from the specified workspace. |
| `dataAgent` | Items | **POST** | `/workspaces/{workspaceId}/dataAgents` | `Items_CreateDataAgent` | Creates a DataAgent in the specified workspace. |
| `dataAgent` | Items | **GET** | `/workspaces/{workspaceId}/dataAgents/{dataAgentId}` | `Items_GetDataAgent` | Returns properties of the specified DataAgent. |
| `dataAgent` | Items | **PATCH** | `/workspaces/{workspaceId}/dataAgents/{dataAgentId}` | `Items_UpdateDataAgent` | Updates the properties of the specified DataAgent. |
| `dataAgent` | Items | **DELETE** | `/workspaces/{workspaceId}/dataAgents/{dataAgentId}` | `Items_DeleteDataAgent` | Deletes the specified DataAgent. |
| `dataAgent` | Items | **POST** | `/workspaces/{workspaceId}/dataAgents/{dataAgentId}/getDefinition` | `Items_GetDataAgentDefinition` | Returns the specified DataAgent public definition. |
| `dataAgent` | Items | **POST** | `/workspaces/{workspaceId}/dataAgents/{dataAgentId}/staging/publish` | `Items_PublishDataAgent` | Publishes the staging configuration of the specified DataAgent. |
| `dataAgent` | Items | **POST** | `/workspaces/{workspaceId}/dataAgents/{dataAgentId}/updateDefinition` | `Items_UpdateDataAgentDefinition` | Overrides the definition for the specified DataAgent. |
| `dataAgent` | Published | **GET** | `/workspaces/{workspaceId}/dataAgents/{dataAgentId}/datasources` | `Published_ListDatasources` | Returns a list of published datasources for the specified DataAgent. |
| `dataAgent` | Published | **GET** | `/workspaces/{workspaceId}/dataAgents/{dataAgentId}/datasources/{datasourceId}` | `Published_GetDatasource` | Returns metadata for a specific published datasource of the specified DataAgent. |
| `dataAgent` | Published | **GET** | `/workspaces/{workspaceId}/dataAgents/{dataAgentId}/datasources/{datasourceId}/elements` | `Published_ListDatasourceElements` | Returns schema elements at a level of the schema tree for a published datasource. |
| `dataAgent` | Published | **GET** | `/workspaces/{workspaceId}/dataAgents/{dataAgentId}/datasources/{datasourceId}/fewshots` | `Published_ListDatasourceFewshots` | Returns a list of published fewshots for a datasource of the specified DataAgent. |
| `dataAgent` | Published | **GET** | `/workspaces/{workspaceId}/dataAgents/{dataAgentId}/datasources/{datasourceId}/fewshots/{fewShotId}` | `Published_GetDatasourceFewshot` | Returns a specific published fewshot by ID. |
| `dataAgent` | Published | **GET** | `/workspaces/{workspaceId}/dataAgents/{dataAgentId}/settings` | `Published_GetSettings` | Returns the published settings for the specified DataAgent. |
| `dataAgent` | Staging | **GET** | `/workspaces/{workspaceId}/dataAgents/{dataAgentId}/staging/datasources` | `Staging_ListDatasources` | Returns a list of staging datasources for the specified DataAgent. |
| `dataAgent` | Staging | **POST** | `/workspaces/{workspaceId}/dataAgents/{dataAgentId}/staging/datasources` | `Staging_CreateDatasource` | Creates a datasource in the staging environment of the specified DataAgent. |
| `dataAgent` | Staging | **GET** | `/workspaces/{workspaceId}/dataAgents/{dataAgentId}/staging/datasources/{datasourceId}` | `Staging_GetDatasource` | Returns metadata for a specific staging datasource of the specified DataAgent. |
| `dataAgent` | Staging | **PATCH** | `/workspaces/{workspaceId}/dataAgents/{dataAgentId}/staging/datasources/{datasourceId}` | `Staging_UpdateDatasource` | Updates metadata for a specific staging datasource of the specified DataAgent. |
| `dataAgent` | Staging | **DELETE** | `/workspaces/{workspaceId}/dataAgents/{dataAgentId}/staging/datasources/{datasourceId}` | `Staging_DeleteDatasource` | Deletes a datasource from the staging environment of the specified DataAgent. |
| `dataAgent` | Staging | **GET** | `/workspaces/{workspaceId}/dataAgents/{dataAgentId}/staging/datasources/{datasourceId}/elements` | `Staging_ListDatasourceElements` | Returns schema elements at a level of the schema tree for a staging datasource. |
| `dataAgent` | Staging | **PATCH** | `/workspaces/{workspaceId}/dataAgents/{dataAgentId}/staging/datasources/{datasourceId}/elements` | `Staging_UpdateDatasourceElement` | Updates a specific schema element for a staging datasource. |
| `dataAgent` | Staging | **DELETE** | `/workspaces/{workspaceId}/dataAgents/{dataAgentId}/staging/datasources/{datasourceId}/elements` | `Staging_DeleteDatasourceElement` | Deletes a schema element that is no longer present in the live schema from a staging datasource. |
| `dataAgent` | Staging | **GET** | `/workspaces/{workspaceId}/dataAgents/{dataAgentId}/staging/datasources/{datasourceId}/fewshots` | `Staging_ListDatasourceFewshots` | Returns a list of staging fewshots for a datasource of the specified DataAgent. |
| `dataAgent` | Staging | **POST** | `/workspaces/{workspaceId}/dataAgents/{dataAgentId}/staging/datasources/{datasourceId}/fewshots` | `Staging_CreateDatasourceFewshot` | Creates a new fewshot for a staging datasource of the specified DataAgent. |
| `dataAgent` | Staging | **POST** | `/workspaces/{workspaceId}/dataAgents/{dataAgentId}/staging/datasources/{datasourceId}/fewshots/deleteAll` | `Staging_DeleteAllDatasourceFewshots` | Deletes all fewshots for a staging datasource of the specified DataAgent. |
| `dataAgent` | Staging | **GET** | `/workspaces/{workspaceId}/dataAgents/{dataAgentId}/staging/datasources/{datasourceId}/fewshots/{fewShotId}` | `Staging_GetDatasourceFewshot` | Returns a specific staging fewshot by ID. |
| `dataAgent` | Staging | **PATCH** | `/workspaces/{workspaceId}/dataAgents/{dataAgentId}/staging/datasources/{datasourceId}/fewshots/{fewShotId}` | `Staging_UpdateDatasourceFewshot` | Updates a specific staging fewshot. |
| `dataAgent` | Staging | **DELETE** | `/workspaces/{workspaceId}/dataAgents/{dataAgentId}/staging/datasources/{datasourceId}/fewshots/{fewShotId}` | `Staging_DeleteDatasourceFewshot` | Deletes a specific staging fewshot. |
| `dataAgent` | Staging | **POST** | `/workspaces/{workspaceId}/dataAgents/{dataAgentId}/staging/reset` | `Staging_Reset` | Reverts the staging environment of the specified DataAgent to the published state. |
| `dataAgent` | Staging | **GET** | `/workspaces/{workspaceId}/dataAgents/{dataAgentId}/staging/settings` | `Staging_GetSettings` | Returns the staging (draft) settings for the specified DataAgent. |
| `dataAgent` | Staging | **PATCH** | `/workspaces/{workspaceId}/dataAgents/{dataAgentId}/staging/settings` | `Staging_UpdateSettings` | Updates the staging settings for the specified DataAgent. |
| `dataBuildToolJob` | BackgroundJobs | **POST** | `/workspaces/{workspaceId}/dataBuildToolJobs/{dataBuildToolJobId}/jobs/execute/instances` | `BackgroundJobs_RunOnDemandExecute` | Run on-demand DataBuildToolJob execute job instance. |
| `dataBuildToolJob` | BackgroundJobs | **POST** | `/workspaces/{workspaceId}/dataBuildToolJobs/{dataBuildToolJobId}/jobs/execute/schedules` | `BackgroundJobs_ScheduleDataBuildToolJob` | Create a new execute schedule for a DataBuildToolJob. |
| `dataBuildToolJob` | Items | **GET** | `/workspaces/{workspaceId}/dataBuildToolJobs` | `Items_ListDataBuildToolJobs` | Returns a list of DataBuildToolJobs from the specified workspace. |
| `dataBuildToolJob` | Items | **POST** | `/workspaces/{workspaceId}/dataBuildToolJobs` | `Items_CreateDataBuildToolJob` | Creates a DataBuildToolJob in the specified workspace. |
| `dataBuildToolJob` | Items | **GET** | `/workspaces/{workspaceId}/dataBuildToolJobs/{dataBuildToolJobId}` | `Items_GetDataBuildToolJob` | Returns properties of the specified DataBuildToolJob. |
| `dataBuildToolJob` | Items | **PATCH** | `/workspaces/{workspaceId}/dataBuildToolJobs/{dataBuildToolJobId}` | `Items_UpdateDataBuildToolJob` | Updates the properties of the specified DataBuildToolJob. |
| `dataBuildToolJob` | Items | **DELETE** | `/workspaces/{workspaceId}/dataBuildToolJobs/{dataBuildToolJobId}` | `Items_DeleteDataBuildToolJob` | Deletes the specified DataBuildToolJob. |
| `dataBuildToolJob` | Items | **POST** | `/workspaces/{workspaceId}/dataBuildToolJobs/{dataBuildToolJobId}/getDefinition` | `Items_GetDataBuildToolJobDefinition` | Returns the specified DataBuildToolJob public definition. |
| `dataBuildToolJob` | Items | **POST** | `/workspaces/{workspaceId}/dataBuildToolJobs/{dataBuildToolJobId}/updateDefinition` | `Items_UpdateDataBuildToolJobDefinition` | Overrides the definition for the specified DataBuildToolJob. |
| `dataPipeline` | BackgroundJobs | **GET** | `/workspaces/{workspaceId}/dataPipelines/{dataPipelineId}/jobs/execute/instances` | `BackgroundJobs_ListExecuteJobInstances` | Returns a list of execute job instances for the specified data pipeline. |
| `dataPipeline` | BackgroundJobs | **POST** | `/workspaces/{workspaceId}/dataPipelines/{dataPipelineId}/jobs/execute/instances` | `BackgroundJobs_RunOnDemandExecute` | Runs an on-demand execute job instance. |
| `dataPipeline` | BackgroundJobs | **GET** | `/workspaces/{workspaceId}/dataPipelines/{dataPipelineId}/jobs/execute/instances/{jobInstanceId}` | `BackgroundJobs_GetExecuteJobInstance` | Returns the specified execute job instance for a data pipeline. |
| `dataPipeline` | BackgroundJobs | **GET** | `/workspaces/{workspaceId}/dataPipelines/{dataPipelineId}/jobs/execute/schedules` | `BackgroundJobs_ListExecuteSchedules` | Returns a list of execute schedules for the specified data pipeline. |
| `dataPipeline` | BackgroundJobs | **POST** | `/workspaces/{workspaceId}/dataPipelines/{dataPipelineId}/jobs/execute/schedules` | `BackgroundJobs_ScheduleExecute` | Create a new execute schedule for a data pipeline. |
| `dataPipeline` | BackgroundJobs | **GET** | `/workspaces/{workspaceId}/dataPipelines/{dataPipelineId}/jobs/execute/schedules/{scheduleId}` | `BackgroundJobs_GetExecuteSchedule` | Returns the specified execute schedule for a data pipeline. |
| `dataPipeline` | BackgroundJobs | **PATCH** | `/workspaces/{workspaceId}/dataPipelines/{dataPipelineId}/jobs/execute/schedules/{scheduleId}` | `BackgroundJobs_UpdateExecuteSchedule` | Updates the specified execute schedule for a data pipeline. |
| `dataPipeline` | BackgroundJobs | **DELETE** | `/workspaces/{workspaceId}/dataPipelines/{dataPipelineId}/jobs/execute/schedules/{scheduleId}` | `BackgroundJobs_DeleteExecuteSchedule` | Deletes the specified execute schedule for a data pipeline. |
| `dataPipeline` | Items | **GET** | `/workspaces/{workspaceId}/dataPipelines` | `Items_ListDataPipelines` | Returns a list of data pipelines from the specified workspace. |
| `dataPipeline` | Items | **POST** | `/workspaces/{workspaceId}/dataPipelines` | `Items_CreateDataPipeline` | Creates a data pipeline in the specified workspace. |
| `dataPipeline` | Items | **GET** | `/workspaces/{workspaceId}/dataPipelines/{dataPipelineId}` | `Items_GetDataPipeline` | Returns properties of the specified data pipeline. |
| `dataPipeline` | Items | **PATCH** | `/workspaces/{workspaceId}/dataPipelines/{dataPipelineId}` | `Items_UpdateDataPipeline` | Updates the properties of the specified data pipeline. |
| `dataPipeline` | Items | **DELETE** | `/workspaces/{workspaceId}/dataPipelines/{dataPipelineId}` | `Items_DeleteDataPipeline` | Deletes the specified data pipeline. |
| `dataPipeline` | Items | **POST** | `/workspaces/{workspaceId}/dataPipelines/{dataPipelineId}/getDefinition` | `Items_GetDataPipelineDefinition` | Returns the specified data pipeline public definition. |
| `dataPipeline` | Items | **POST** | `/workspaces/{workspaceId}/dataPipelines/{dataPipelineId}/updateDefinition` | `Items_UpdateDataPipelineDefinition` | Overrides the definition for the specified data pipeline. |
| `dataflow` | BackgroundJobs | **POST** | `/workspaces/{workspaceId}/dataflows/{dataflowId}/jobs/applyChanges/instances` | `BackgroundJobs_RunOnDemandApplyChanges` | Run on-demand apply changes job instance. |
| `dataflow` | BackgroundJobs | **POST** | `/workspaces/{workspaceId}/dataflows/{dataflowId}/jobs/applyChanges/schedules` | `BackgroundJobs_ScheduleApplyChanges` | Create a new apply changes schedule for a dataflow. A dataflow can create maximum 20 schedulers. |
| `dataflow` | BackgroundJobs | **POST** | `/workspaces/{workspaceId}/dataflows/{dataflowId}/jobs/execute/instances` | `BackgroundJobs_RunOnDemandExecute` | Run on-demand execute job instance. |
| `dataflow` | BackgroundJobs | **POST** | `/workspaces/{workspaceId}/dataflows/{dataflowId}/jobs/execute/schedules` | `BackgroundJobs_ScheduleExecute` | Create a new execute schedule for a dataflow. A dataflow can create maximum 20 schedulers. |
| `dataflow` | Items | **GET** | `/workspaces/{workspaceId}/dataflows` | `Items_ListDataflows` | Returns a list of Dataflows from the specified workspace. |
| `dataflow` | Items | **POST** | `/workspaces/{workspaceId}/dataflows` | `Items_CreateDataflow` | Creates a Dataflow in the specified workspace. |
| `dataflow` | Items | **GET** | `/workspaces/{workspaceId}/dataflows/{dataflowId}` | `Items_GetDataflow` | Returns properties of the specified Dataflow. |
| `dataflow` | Items | **PATCH** | `/workspaces/{workspaceId}/dataflows/{dataflowId}` | `Items_UpdateDataflow` | Updates the properties of the specified Dataflow. |
| `dataflow` | Items | **DELETE** | `/workspaces/{workspaceId}/dataflows/{dataflowId}` | `Items_DeleteDataflow` | Deletes the specified Dataflow. |
| `dataflow` | Items | **POST** | `/workspaces/{workspaceId}/dataflows/{dataflowId}/getDefinition` | `Items_GetDataflowDefinition` | Returns the specified Dataflow public definition. |
| `dataflow` | Items | **GET** | `/workspaces/{workspaceId}/dataflows/{dataflowId}/parameters` | `Items_DiscoverDataflowParameters` | Retrieves all parameters defined in the specified Dataflow. |
| `dataflow` | Items | **POST** | `/workspaces/{workspaceId}/dataflows/{dataflowId}/updateDefinition` | `Items_UpdateDataflowDefinition` | Overrides the definition for the specified Dataflow. |
| `dataflow` | QueryExecution | **POST** | `/workspaces/{workspaceId}/dataflows/{dataflowId}/executeQuery` | `QueryExecution_ExecuteQuery` | Executes a query against a dataflow and returns the result. |
| `datamart` | Items | **GET** | `/workspaces/{workspaceId}/datamarts` | `Items_ListDatamarts` | Returns a list of datamarts from the specified workspace. |
| `digitalTwinBuilder` | Items | **GET** | `/workspaces/{workspaceId}/digitaltwinbuilders` | `Items_ListDigitalTwinBuilders` | Returns a list of DigitalTwinBuilders from the specified workspace. |
| `digitalTwinBuilder` | Items | **POST** | `/workspaces/{workspaceId}/digitaltwinbuilders` | `Items_CreateDigitalTwinBuilder` | Creates a DigitalTwinBuilder in the specified workspace. |
| `digitalTwinBuilder` | Items | **GET** | `/workspaces/{workspaceId}/digitaltwinbuilders/{digitaltwinbuilderId}` | `Items_GetDigitalTwinBuilder` | Returns properties of the specified DigitalTwinBuilder. |
| `digitalTwinBuilder` | Items | **PATCH** | `/workspaces/{workspaceId}/digitaltwinbuilders/{digitaltwinbuilderId}` | `Items_UpdateDigitalTwinBuilder` | Updates the properties of the specified DigitalTwinBuilder. |
| `digitalTwinBuilder` | Items | **DELETE** | `/workspaces/{workspaceId}/digitaltwinbuilders/{digitaltwinbuilderId}` | `Items_DeleteDigitalTwinBuilder` | Deletes the specified DigitalTwinBuilder. |
| `digitalTwinBuilder` | Items | **POST** | `/workspaces/{workspaceId}/digitaltwinbuilders/{digitaltwinbuilderId}/getDefinition` | `Items_GetDigitalTwinBuilderDefinition` | Returns the specified DigitalTwinBuilder public definition. |
| `digitalTwinBuilder` | Items | **POST** | `/workspaces/{workspaceId}/digitaltwinbuilders/{digitaltwinbuilderId}/updateDefinition` | `Items_UpdateDigitalTwinBuilderDefinition` | Updates the definition of a specified DigitalTwinBuilder. The update overrides the current definitio |
| `digitalTwinBuilderFlow` | Items | **GET** | `/workspaces/{workspaceId}/digitalTwinBuilderFlows` | `Items_ListDigitalTwinBuilderFlows` | Returns a list of Digital Twin Builder Flows from the specified workspace. |
| `digitalTwinBuilderFlow` | Items | **POST** | `/workspaces/{workspaceId}/digitalTwinBuilderFlows` | `Items_CreateDigitalTwinBuilderFlow` | Creates a Digital Twin Builder Flow in the specified workspace. |
| `digitalTwinBuilderFlow` | Items | **GET** | `/workspaces/{workspaceId}/digitalTwinBuilderFlows/{digitalTwinBuilderFlowId}` | `Items_GetDigitalTwinBuilderFlow` | Returns properties of the specified Digital Twin Builder Flow. |
| `digitalTwinBuilderFlow` | Items | **PATCH** | `/workspaces/{workspaceId}/digitalTwinBuilderFlows/{digitalTwinBuilderFlowId}` | `Items_UpdateDigitalTwinBuilderFlow` | Updates the properties of the specified Digital Twin Builder Flow. |
| `digitalTwinBuilderFlow` | Items | **DELETE** | `/workspaces/{workspaceId}/digitalTwinBuilderFlows/{digitalTwinBuilderFlowId}` | `Items_DeleteDigitalTwinBuilderFlow` | Deletes the specified Digital Twin Builder Flow. |
| `digitalTwinBuilderFlow` | Items | **POST** | `/workspaces/{workspaceId}/digitalTwinBuilderFlows/{digitalTwinBuilderFlowId}/getDefinition` | `Items_GetDigitalTwinBuilderFlowDefinition` | Returns the specified Digital Twin Builder Flow public definition. |
| `digitalTwinBuilderFlow` | Items | **POST** | `/workspaces/{workspaceId}/digitalTwinBuilderFlows/{digitalTwinBuilderFlowId}/updateDefinition` | `Items_UpdateDigitalTwinBuilderFlowDefinition` | Overrides the definition for the specified Digital Twin Builder Flow. |
| `environment` | Items | **GET** | `/workspaces/{workspaceId}/environments` | `Items_ListEnvironments` | Returns a list of environments from the specified workspace. |
| `environment` | Items | **POST** | `/workspaces/{workspaceId}/environments` | `Items_CreateEnvironment` | Creates an environment in the specified workspace. |
| `environment` | Items | **GET** | `/workspaces/{workspaceId}/environments/{environmentId}` | `Items_GetEnvironment` | Returns properties of the specified environment. |
| `environment` | Items | **PATCH** | `/workspaces/{workspaceId}/environments/{environmentId}` | `Items_UpdateEnvironment` | Updates the properties of the specified environment. |
| `environment` | Items | **DELETE** | `/workspaces/{workspaceId}/environments/{environmentId}` | `Items_DeleteEnvironment` | Deletes the specified environment. |
| `environment` | Items | **POST** | `/workspaces/{workspaceId}/environments/{environmentId}/getDefinition` | `Items_GetEnvironmentDefinition` | Returns the specified environment public definition. |
| `environment` | Items | **POST** | `/workspaces/{workspaceId}/environments/{environmentId}/staging/cancelPublish` | `Items_CancelPublishEnvironment` | Trigger an environment publish cancellation. |
| `environment` | Items | **POST** | `/workspaces/{workspaceId}/environments/{environmentId}/staging/publish?beta=false` | `Items_PublishEnvironment` | Trigger an environment publish operation. |
| `environment` | Items | **POST** | `/workspaces/{workspaceId}/environments/{environmentId}/staging/publish?beta=true` | `Items_Publish_Environment_(beta)` | Trigger an environment publish operation. |
| `environment` | Items | **POST** | `/workspaces/{workspaceId}/environments/{environmentId}/updateDefinition` | `Items_UpdateEnvironmentDefinition` | Overrides the definition for the specified environment. |
| `environment` | Published | **GET** | `/workspaces/{workspaceId}/environments/{environmentId}/libraries/exportExternalLibraries` | `Published_ExportExternalLibraries` | Export a set of external libraries published in the environment in `YML` format. |
| `environment` | Published | **GET** | `/workspaces/{workspaceId}/environments/{environmentId}/libraries?beta=false` | `Published_ListLibraries` | Get environment published libraries. |
| `environment` | Published | **GET** | `/workspaces/{workspaceId}/environments/{environmentId}/libraries?beta=true` | `Published_List_Libraries_(beta)` | Get environment published libraries. |
| `environment` | Published | **GET** | `/workspaces/{workspaceId}/environments/{environmentId}/sparkcompute?beta=false` | `Published_GetSparkCompute` | Get environment spark compute. |
| `environment` | Published | **GET** | `/workspaces/{workspaceId}/environments/{environmentId}/sparkcompute?beta=true` | `Published_Get_Spark_Compute_(beta)` | Get environment spark compute. |
| `environment` | Staging | **POST** | `/workspaces/{workspaceId}/environments/{environmentId}/staging/libraries` | `Staging_Upload_Custom_Library_(beta)` | Upload spark library into environment. |
| `environment` | Staging | **DELETE** | `/workspaces/{workspaceId}/environments/{environmentId}/staging/libraries` | `Staging_Delete_Custom_Library_(beta)` | Deletes a library from environment. It supports deleting one file at a time. |
| `environment` | Staging | **GET** | `/workspaces/{workspaceId}/environments/{environmentId}/staging/libraries/exportExternalLibraries` | `Staging_ExportExternalLibraries` | Export a set of external libraries saved in the environment in YML format. |
| `environment` | Staging | **POST** | `/workspaces/{workspaceId}/environments/{environmentId}/staging/libraries/importExternalLibraries` | `Staging_ImportExternalLibraries` | Upload spark external libraries as an `environment.yml` file into environment. It overrides the list |
| `environment` | Staging | **POST** | `/workspaces/{workspaceId}/environments/{environmentId}/staging/libraries/removeExternalLibrary` | `Staging_RemoveExternalLibrary` | Delete a spark external library from an environment. |
| `environment` | Staging | **POST** | `/workspaces/{workspaceId}/environments/{environmentId}/staging/libraries/{libraryName}` | `Staging_UploadCustomLibrary` | Upload spark library into environment. |
| `environment` | Staging | **DELETE** | `/workspaces/{workspaceId}/environments/{environmentId}/staging/libraries/{libraryName}` | `Staging_DeleteCustomLibrary` | Delete a custom library from environment. It supports deleting one file at a time. The supported fil |
| `environment` | Staging | **GET** | `/workspaces/{workspaceId}/environments/{environmentId}/staging/libraries?beta=false` | `Staging_ListLibraries` | Get a list of libraries staged into environment. |
| `environment` | Staging | **GET** | `/workspaces/{workspaceId}/environments/{environmentId}/staging/libraries?beta=true` | `Staging_List_Libraries_(beta)` | Get environment staging libraries. |
| `environment` | Staging | **GET** | `/workspaces/{workspaceId}/environments/{environmentId}/staging/sparkcompute?beta=false` | `Staging_GetSparkCompute` | Get environment staging spark compute. |
| `environment` | Staging | **PATCH** | `/workspaces/{workspaceId}/environments/{environmentId}/staging/sparkcompute?beta=false` | `Staging_UpdateSparkCompute` | Update environment staging spark compute. If you want to delete a spark property, set its value as n |
| `environment` | Staging | **GET** | `/workspaces/{workspaceId}/environments/{environmentId}/staging/sparkcompute?beta=true` | `Staging_Get_Spark_Compute_(beta)` | Get environment staging spark compute. |
| `environment` | Staging | **PATCH** | `/workspaces/{workspaceId}/environments/{environmentId}/staging/sparkcompute?beta=true` | `Staging_Update_Spark_Compute_(beta)` | Update environment staging spark compute. If you want to delete a spark property, set its value as n |
| `eventSchemaSet` | Items | **GET** | `/workspaces/{workspaceId}/eventSchemaSets` | `Items_ListEventSchemaSets` | Returns a list of EventSchemaSets from the specified workspace. |
| `eventSchemaSet` | Items | **POST** | `/workspaces/{workspaceId}/eventSchemaSets` | `Items_CreateEventSchemaSet` | Creates an EventSchemaSet in the specified workspace. |
| `eventSchemaSet` | Items | **GET** | `/workspaces/{workspaceId}/eventSchemaSets/{eventSchemaSetId}` | `Items_GetEventSchemaSet` | Returns properties of the specified EventSchemaSet. |
| `eventSchemaSet` | Items | **PATCH** | `/workspaces/{workspaceId}/eventSchemaSets/{eventSchemaSetId}` | `Items_UpdateEventSchemaSet` | Updates properties of the specified EventSchemaSet. |
| `eventSchemaSet` | Items | **DELETE** | `/workspaces/{workspaceId}/eventSchemaSets/{eventSchemaSetId}` | `Items_DeleteEventSchemaSet` | Deletes the specified EventSchemaSet. |
| `eventSchemaSet` | Items | **POST** | `/workspaces/{workspaceId}/eventSchemaSets/{eventSchemaSetId}/getDefinition` | `Items_GetEventSchemaSetDefinition` | Returns the specified EventSchemaSet definition. |
| `eventSchemaSet` | Items | **POST** | `/workspaces/{workspaceId}/eventSchemaSets/{eventSchemaSetId}/updateDefinition` | `Items_UpdateEventSchemaSetDefinition` | Overrides the definition for the specified EventSchemaSet. |
| `eventhouse` | Items | **GET** | `/workspaces/{workspaceId}/eventhouses` | `Items_ListEventhouses` | Returns a list of eventhouses from the specified workspace. |
| `eventhouse` | Items | **POST** | `/workspaces/{workspaceId}/eventhouses` | `Items_CreateEventhouse` | Creates an eventhouse in the specified workspace. |
| `eventhouse` | Items | **GET** | `/workspaces/{workspaceId}/eventhouses/{eventhouseId}` | `Items_GetEventhouse` | Returns properties of the specified eventhouse. |
| `eventhouse` | Items | **PATCH** | `/workspaces/{workspaceId}/eventhouses/{eventhouseId}` | `Items_UpdateEventhouse` | Updates the properties of the specified eventhouse. |
| `eventhouse` | Items | **DELETE** | `/workspaces/{workspaceId}/eventhouses/{eventhouseId}` | `Items_DeleteEventhouse` | Deletes the specified eventhouse. |
| `eventhouse` | Items | **POST** | `/workspaces/{workspaceId}/eventhouses/{eventhouseId}/getDefinition` | `Items_GetEventhouseDefinition` | Returns the specified eventhouse public definition. |
| `eventhouse` | Items | **POST** | `/workspaces/{workspaceId}/eventhouses/{eventhouseId}/updateDefinition` | `Items_UpdateEventhouseDefinition` | Overrides the definition for the specified eventhouse. |
| `eventstream` | Items | **GET** | `/workspaces/{workspaceId}/eventstreams` | `Items_ListEventstreams` | Returns a list of eventstreams from the specified workspace. |
| `eventstream` | Items | **POST** | `/workspaces/{workspaceId}/eventstreams` | `Items_CreateEventstream` | Creates an eventstream in the specified workspace. |
| `eventstream` | Items | **GET** | `/workspaces/{workspaceId}/eventstreams/{eventstreamId}` | `Items_GetEventstream` | Returns properties of the specified eventstream. |
| `eventstream` | Items | **PATCH** | `/workspaces/{workspaceId}/eventstreams/{eventstreamId}` | `Items_UpdateEventstream` | Updates the properties of the specified eventstream. |
| `eventstream` | Items | **DELETE** | `/workspaces/{workspaceId}/eventstreams/{eventstreamId}` | `Items_DeleteEventstream` | Deletes the specified eventstream. |
| `eventstream` | Items | **POST** | `/workspaces/{workspaceId}/eventstreams/{eventstreamId}/getDefinition` | `Items_GetEventstreamDefinition` | Returns the specified eventstream public definition. |
| `eventstream` | Items | **POST** | `/workspaces/{workspaceId}/eventstreams/{eventstreamId}/updateDefinition` | `Items_UpdateEventstreamDefinition` | Updates the definition of a specified eventstream. The update overrides the current definition. |
| `eventstream` | Topology | **GET** | `/workspaces/{workspaceId}/eventstreams/{eventstreamId}/destinations/{destinationId}` | `Topology_GetEventstreamDestination` | Returns the specified destination of the eventstream. |
| `eventstream` | Topology | **GET** | `/workspaces/{workspaceId}/eventstreams/{eventstreamId}/destinations/{destinationId}/connection` | `Topology_GetEventstreamDestinationConnection` | Returns the connection information of a specified destination of the eventstream. |
| `eventstream` | Topology | **POST** | `/workspaces/{workspaceId}/eventstreams/{eventstreamId}/destinations/{destinationId}/pause` | `Topology_PauseEventstreamDestination` | Pause running the specified destination in the eventstream. |
| `eventstream` | Topology | **POST** | `/workspaces/{workspaceId}/eventstreams/{eventstreamId}/destinations/{destinationId}/resume` | `Topology_ResumeEventstreamDestination` | Resume running the specified destination in the eventstream. |
| `eventstream` | Topology | **POST** | `/workspaces/{workspaceId}/eventstreams/{eventstreamId}/pause` | `Topology_PauseEventstream` | Pause running all supported sources and destinations of the eventstream. |
| `eventstream` | Topology | **POST** | `/workspaces/{workspaceId}/eventstreams/{eventstreamId}/resume` | `Topology_ResumeEventstream` | Resume running all supported sources and destinations of the eventstream. |
| `eventstream` | Topology | **GET** | `/workspaces/{workspaceId}/eventstreams/{eventstreamId}/sources/{sourceId}` | `Topology_GetEventstreamSource` | Returns the specified source of the eventstream. |
| `eventstream` | Topology | **GET** | `/workspaces/{workspaceId}/eventstreams/{eventstreamId}/sources/{sourceId}/connection` | `Topology_GetEventstreamSourceConnection` | Returns the connection information of specified source of the eventstream. |
| `eventstream` | Topology | **POST** | `/workspaces/{workspaceId}/eventstreams/{eventstreamId}/sources/{sourceId}/pause` | `Topology_PauseEventstreamSource` | Pause running the specified source in the eventstream. |
| `eventstream` | Topology | **POST** | `/workspaces/{workspaceId}/eventstreams/{eventstreamId}/sources/{sourceId}/resume` | `Topology_ResumeEventstreamSource` | Resume running the specified source in the eventstream. |
| `eventstream` | Topology | **GET** | `/workspaces/{workspaceId}/eventstreams/{eventstreamId}/topology` | `Topology_GetEventstreamTopology` | Returns the topology of the specified eventstream. |
| `graphModel` | BackgroundJobs | **POST** | `/workspaces/{workspaceId}/graphModels/{graphModelId}/jobs/refreshGraph/instances` | `BackgroundJobs_RunOnDemandRefreshGraph` | Run on-demand RefreshGraph job model. |
| `graphModel` | Items | **GET** | `/workspaces/{workspaceId}/graphModels` | `Items_ListGraphModels` | Returns a list of GraphModels from the specified workspace. |
| `graphModel` | Items | **POST** | `/workspaces/{workspaceId}/graphModels` | `Items_CreateGraphModel` | Creates a GraphModel in the specified workspace. |
| `graphModel` | Items | **GET** | `/workspaces/{workspaceId}/graphModels/{graphModelId}` | `Items_GetGraphModel` | Returns properties of the specified GraphModel. |
| `graphModel` | Items | **PATCH** | `/workspaces/{workspaceId}/graphModels/{graphModelId}` | `Items_UpdateGraphModel` | Updates the properties of the specified GraphModel. |
| `graphModel` | Items | **DELETE** | `/workspaces/{workspaceId}/graphModels/{graphModelId}` | `Items_DeleteGraphModel` | Deletes the specified GraphModel. |
| `graphModel` | Items | **POST** | `/workspaces/{workspaceId}/graphModels/{graphModelId}/executeQuery?beta=true` | `Items_Execute_Query_(beta)` | Executes a query on the specified graph model. |
| `graphModel` | Items | **POST** | `/workspaces/{workspaceId}/graphModels/{graphModelId}/getDefinition` | `Items_GetGraphModelDefinition` | Returns the specified GraphModel public definition. |
| `graphModel` | Items | **GET** | `/workspaces/{workspaceId}/graphModels/{graphModelId}/getQueryableGraphType?beta=true` | `Items_Get_Queryable_Graph_Type_(beta)` | Get the current queryable graph type. |
| `graphModel` | Items | **POST** | `/workspaces/{workspaceId}/graphModels/{graphModelId}/updateDefinition` | `Items_UpdateGraphModelDefinition` | Overrides the definition for the specified GraphModel. |
| `graphQLApi` | Items | **GET** | `/workspaces/{workspaceId}/graphQLApis` | `Items_ListGraphQLApis` | Returns a list of API for GraphQL items from the specified workspace. |
| `graphQLApi` | Items | **POST** | `/workspaces/{workspaceId}/graphQLApis` | `Items_CreateGraphQLApi` | Creates a API for GraphQL item in the specified workspace. |
| `graphQLApi` | Items | **GET** | `/workspaces/{workspaceId}/graphQLApis/{graphQLApiId}` | `Items_GetGraphQLApi` | Returns properties of the specified API for GraphQL. |
| `graphQLApi` | Items | **PATCH** | `/workspaces/{workspaceId}/graphQLApis/{graphQLApiId}` | `Items_UpdateGraphQLApi` | Updates the properties of the specified API for GraphQL. |
| `graphQLApi` | Items | **DELETE** | `/workspaces/{workspaceId}/graphQLApis/{graphQLApiId}` | `Items_DeleteGraphQLApi` | Deletes the specified API for GraphQL. |
| `graphQLApi` | Items | **POST** | `/workspaces/{workspaceId}/graphQLApis/{graphQLApiId}/getDefinition` | `Items_GetGraphQLApiDefinition` | Returns the specified GraphQLApi public definition. |
| `graphQLApi` | Items | **POST** | `/workspaces/{workspaceId}/graphQLApis/{graphQLApiId}/updateDefinition` | `Items_UpdateGraphQLApiDefinition` | Overrides the definition for the specified API for GraphQL. |
| `graphQuerySet` | Items | **GET** | `/workspaces/{workspaceId}/graphQuerySets` | `Items_ListGraphQuerySets` | Returns a list of graph querysets from the specified workspace. |
| `graphQuerySet` | Items | **POST** | `/workspaces/{workspaceId}/graphQuerySets` | `Items_CreateGraphQuerySet` | Creates a GraphQuerySet in the specified workspace. |
| `graphQuerySet` | Items | **GET** | `/workspaces/{workspaceId}/graphQuerySets/{graphQuerySetId}` | `Items_GetGraphQuerySet` | Returns properties of the specified GraphQuerySet. |
| `graphQuerySet` | Items | **PATCH** | `/workspaces/{workspaceId}/graphQuerySets/{graphQuerySetId}` | `Items_UpdateGraphQuerySet` | Updates the properties of the specified GraphQuerySet. |
| `graphQuerySet` | Items | **DELETE** | `/workspaces/{workspaceId}/graphQuerySets/{graphQuerySetId}` | `Items_DeleteGraphQuerySet` | Deletes the specified GraphQuerySet. |
| `graphQuerySet` | Items | **POST** | `/workspaces/{workspaceId}/graphQuerySets/{graphQuerySetId}/getDefinition` | `Items_GetGraphQuerySetDefinition` | Returns the specified graph queryset public definition. |
| `graphQuerySet` | Items | **POST** | `/workspaces/{workspaceId}/graphQuerySets/{graphQuerySetId}/updateDefinition` | `Items_UpdateGraphQuerySetDefinition` | Overrides the definition for the specified graph queryset. |
| `kqlDashboard` | Items | **GET** | `/workspaces/{workspaceId}/kqlDashboards` | `Items_ListKQLDashboards` | Returns a list of KQL dashboards from the specified workspace. |
| `kqlDashboard` | Items | **POST** | `/workspaces/{workspaceId}/kqlDashboards` | `Items_CreateKQLDashboard` | Creates a KQL dashboard in the specified workspace. |
| `kqlDashboard` | Items | **GET** | `/workspaces/{workspaceId}/kqlDashboards/{kqlDashboardId}` | `Items_GetKQLDashboard` | Returns properties of the specified KQL dashboard. |
| `kqlDashboard` | Items | **PATCH** | `/workspaces/{workspaceId}/kqlDashboards/{kqlDashboardId}` | `Items_UpdateKQLDashboard` | Updates the properties of the specified KQL dashboard. |
| `kqlDashboard` | Items | **DELETE** | `/workspaces/{workspaceId}/kqlDashboards/{kqlDashboardId}` | `Items_DeleteKQLDashboard` | Deletes the specified KQL dashboard. |
| `kqlDashboard` | Items | **POST** | `/workspaces/{workspaceId}/kqlDashboards/{kqlDashboardId}/getDefinition` | `Items_GetKQLDashboardDefinition` | Returns the specified KQL dashboard public definition. |
| `kqlDashboard` | Items | **POST** | `/workspaces/{workspaceId}/kqlDashboards/{kqlDashboardId}/updateDefinition` | `Items_UpdateKQLDashboardDefinition` | Overrides the definition for the specified KQL dashboard. |
| `kqlDatabase` | Items | **GET** | `/workspaces/{workspaceId}/kqlDatabases` | `Items_ListKQLDatabases` | Returns a list of KQL databases from the specified workspace. |
| `kqlDatabase` | Items | **POST** | `/workspaces/{workspaceId}/kqlDatabases` | `Items_CreateKQLDatabase` | Creates a KQL database in the specified workspace. |
| `kqlDatabase` | Items | **GET** | `/workspaces/{workspaceId}/kqlDatabases/{kqlDatabaseId}` | `Items_GetKQLDatabase` | Returns properties of the specified KQL database. |
| `kqlDatabase` | Items | **PATCH** | `/workspaces/{workspaceId}/kqlDatabases/{kqlDatabaseId}` | `Items_UpdateKQLDatabase` | Updates the properties of the specified KQL database. |
| `kqlDatabase` | Items | **DELETE** | `/workspaces/{workspaceId}/kqlDatabases/{kqlDatabaseId}` | `Items_DeleteKQLDatabase` | Deletes the specified KQL database. |
| `kqlDatabase` | Items | **POST** | `/workspaces/{workspaceId}/kqlDatabases/{kqlDatabaseId}/getDefinition` | `Items_GetKQLDatabaseDefinition` | Returns the specified KQL database public definition. |
| `kqlDatabase` | Items | **POST** | `/workspaces/{workspaceId}/kqlDatabases/{kqlDatabaseId}/updateDefinition` | `Items_UpdateKQLDatabaseDefinition` | Overrides the definition for the specified KQL database. |
| `kqlDatabase` | TableShortcuts | **GET** | `/workspaces/{workspaceId}/kqlDatabases/{kqlDatabaseId}/shortcuts` | `TableShortcuts_ListShortcuts` | Returns a list of all table shortcuts under a database. |
| `kqlDatabase` | TableShortcuts | **POST** | `/workspaces/{workspaceId}/kqlDatabases/{kqlDatabaseId}/shortcuts` | `TableShortcuts_CreateShortcut` | Creates a new table shortcut under a database. |
| `kqlDatabase` | TableShortcuts | **GET** | `/workspaces/{workspaceId}/kqlDatabases/{kqlDatabaseId}/shortcuts/{shortcutName}` | `TableShortcuts_GetShortcut` | Returns the properties of a table shortcut under a database. |
| `kqlDatabase` | TableShortcuts | **DELETE** | `/workspaces/{workspaceId}/kqlDatabases/{kqlDatabaseId}/shortcuts/{shortcutName}` | `TableShortcuts_DeleteShortcut` | Deletes a table shortcut under a database. |
| `kqlQueryset` | Items | **GET** | `/workspaces/{workspaceId}/kqlQuerysets` | `Items_ListKQLQuerysets` | Returns a list of KQL querysets from the specified workspace. |
| `kqlQueryset` | Items | **POST** | `/workspaces/{workspaceId}/kqlQuerysets` | `Items_CreateKQLQueryset` | Creates a KQL queryset in the specified workspace. |
| `kqlQueryset` | Items | **GET** | `/workspaces/{workspaceId}/kqlQuerysets/{kqlQuerysetId}` | `Items_GetKQLQueryset` | Returns properties of the specified KQL queryset. |
| `kqlQueryset` | Items | **PATCH** | `/workspaces/{workspaceId}/kqlQuerysets/{kqlQuerysetId}` | `Items_UpdateKQLQueryset` | Updates the properties of the specified KQL queryset. |
| `kqlQueryset` | Items | **DELETE** | `/workspaces/{workspaceId}/kqlQuerysets/{kqlQuerysetId}` | `Items_DeleteKQLQueryset` | Deletes the specified KQL queryset. |
| `kqlQueryset` | Items | **POST** | `/workspaces/{workspaceId}/kqlQuerysets/{kqlQuerysetId}/getDefinition` | `Items_GetKQLQuerysetDefinition` | Returns the specified KQL queryset public definition. |
| `kqlQueryset` | Items | **POST** | `/workspaces/{workspaceId}/kqlQuerysets/{kqlQuerysetId}/updateDefinition` | `Items_UpdateKQLQuerysetDefinition` | Overrides the definition for the specified KQL queryset. |
| `lakehouse` | BackgroundJobs | **POST** | `/workspaces/{workspaceId}/lakehouses/{lakehouseId}/jobs/refreshMaterializedLakeViews/instances` | `BackgroundJobs_RunOnDemandRefreshMaterializedLakeViews` | Run on-demand [Refresh MaterializedLakeViews](/fabric/data-engineering/materialized-lake-views/refre |
| `lakehouse` | BackgroundJobs | **POST** | `/workspaces/{workspaceId}/lakehouses/{lakehouseId}/jobs/refreshMaterializedLakeViews/schedules` | `BackgroundJobs_CreateRefreshMaterializedLakeViewsSchedule` | Create a new Refresh MaterializedLakeViews schedule for a lakehouse. |
| `lakehouse` | BackgroundJobs | **PATCH** | `/workspaces/{workspaceId}/lakehouses/{lakehouseId}/jobs/refreshMaterializedLakeViews/schedules/{scheduleId}` | `BackgroundJobs_UpdateRefreshMaterializedLakeViewsSchedule` | Update an existing Refresh MaterializedLakeViews schedule for a lakehouse. |
| `lakehouse` | BackgroundJobs | **DELETE** | `/workspaces/{workspaceId}/lakehouses/{lakehouseId}/jobs/refreshMaterializedLakeViews/schedules/{scheduleId}` | `BackgroundJobs_DeleteRefreshMaterializedLakeViewsSchedule` | Delete an existing Refresh MaterializedLakeViews schedule for a lakehouse. |
| `lakehouse` | BackgroundJobs | **POST** | `/workspaces/{workspaceId}/lakehouses/{lakehouseId}/jobs/tableMaintenance/instances` | `BackgroundJobs_RunOnDemandTableMaintenance` | Run on-demand [table maintenance](/fabric/data-engineering/lakehouse-table-maintenance) job instance |
| `lakehouse` | Items | **GET** | `/workspaces/{workspaceId}/lakehouses` | `Items_ListLakehouses` | Returns a list of lakehouses from the specified workspace. |
| `lakehouse` | Items | **POST** | `/workspaces/{workspaceId}/lakehouses` | `Items_CreateLakehouse` | Creates a lakehouse in the specified workspace. |
| `lakehouse` | Items | **GET** | `/workspaces/{workspaceId}/lakehouses/{lakehouseId}` | `Items_GetLakehouse` | Returns properties of the specified lakehouse. |
| `lakehouse` | Items | **PATCH** | `/workspaces/{workspaceId}/lakehouses/{lakehouseId}` | `Items_UpdateLakehouse` | Updates the properties of the specified lakehouse. |
| `lakehouse` | Items | **DELETE** | `/workspaces/{workspaceId}/lakehouses/{lakehouseId}` | `Items_DeleteLakehouse` | Deletes the specified lakehouse. |
| `lakehouse` | Items | **POST** | `/workspaces/{workspaceId}/lakehouses/{lakehouseId}/getDefinition` | `Items_GetLakehouseDefinition` | Returns the specified lakehouse public definition. |
| `lakehouse` | Items | **POST** | `/workspaces/{workspaceId}/lakehouses/{lakehouseId}/updateDefinition` | `Items_UpdateLakehouseDefinition` | Overrides the definition for the specified lakehouse. |
| `lakehouse` | LivySessions | **GET** | `/workspaces/{workspaceId}/lakehouses/{lakehouseId}/livySessions` | `LivySessions_ListLivySessions` | Returns a list of livy sessions from the specified item identifier. |
| `lakehouse` | LivySessions | **GET** | `/workspaces/{workspaceId}/lakehouses/{lakehouseId}/livySessions/{livyId}` | `LivySessions_GetLivySession` | Returns properties of the specified livy session. |
| `lakehouse` | LivySessions | **GET** | `/workspaces/{workspaceId}/lakehouses/{lakehouseId}/livySessions?beta=true` | `LivySessions_List_Livy_Sessions_(beta)` | Returns a list of livy sessions from the specified item identifier (beta). |
| `lakehouse` | MaterializedLakeViews | **POST** | `/workspaces/{workspaceId}/lakehouses/{lakehouseId}/mlvexecutiondefinitions` | `MaterializedLakeViews_CreateMlvExecutionDefinition` | Creates a materialized lake views execution definition. |
| `lakehouse` | MaterializedLakeViews | **GET** | `/workspaces/{workspaceId}/lakehouses/{lakehouseId}/mlvexecutiondefinitions` | `MaterializedLakeViews_ListMlvExecutionDefinitions` | Returns a list of materialized lake views execution definitions for a lakehouse. |
| `lakehouse` | MaterializedLakeViews | **GET** | `/workspaces/{workspaceId}/lakehouses/{lakehouseId}/mlvexecutiondefinitions/{mlvExecutionDefinitionId}` | `MaterializedLakeViews_GetMlvExecutionDefinition` | Returns the specified materialized lake views execution definition. |
| `lakehouse` | MaterializedLakeViews | **PATCH** | `/workspaces/{workspaceId}/lakehouses/{lakehouseId}/mlvexecutiondefinitions/{mlvExecutionDefinitionId}` | `MaterializedLakeViews_UpdateMlvExecutionDefinition` | Updates the specified materialized lake views execution definition. |
| `lakehouse` | MaterializedLakeViews | **DELETE** | `/workspaces/{workspaceId}/lakehouses/{lakehouseId}/mlvexecutiondefinitions/{mlvExecutionDefinitionId}` | `MaterializedLakeViews_DeleteMlvExecutionDefinition` | Deletes the specified materialized lake views execution definition. |
| `lakehouse` | Tables | **POST** | `/workspaces/{workspaceId}/lakehouses/{lakehouseId}/schemas/{schemaName}/tables/{tableName}/load?beta=true` | `Tables_Load_Schema_Table_(beta)` | Starts a load table operation for a table within a schema enabled lakehouse and returns the operatio |
| `lakehouse` | Tables | **GET** | `/workspaces/{workspaceId}/lakehouses/{lakehouseId}/tables` | `Tables_ListTables` | Returns a list of lakehouse Tables. |
| `lakehouse` | Tables | **POST** | `/workspaces/{workspaceId}/lakehouses/{lakehouseId}/tables/{tableName}/load` | `Tables_LoadTable` | Starts a load table operation and returns the operation status URL in the response location header. |
| `map` | Items | **GET** | `/workspaces/{workspaceId}/maps` | `Items_ListMaps` | Returns a list of Maps from the specified workspace. |
| `map` | Items | **POST** | `/workspaces/{workspaceId}/maps` | `Items_CreateMap` | Creates a Map in the specified workspace. |
| `map` | Items | **GET** | `/workspaces/{workspaceId}/maps/{mapId}` | `Items_GetMap` | Returns properties of the specified Map. |
| `map` | Items | **PATCH** | `/workspaces/{workspaceId}/maps/{mapId}` | `Items_UpdateMap` | Updates the properties of the specified Map. |
| `map` | Items | **DELETE** | `/workspaces/{workspaceId}/maps/{mapId}` | `Items_DeleteMap` | Deletes the specified Map. |
| `map` | Items | **POST** | `/workspaces/{workspaceId}/maps/{mapId}/getDefinition` | `Items_GetMapDefinition` | Returns the specified Map public definition. |
| `map` | Items | **POST** | `/workspaces/{workspaceId}/maps/{mapId}/updateDefinition` | `Items_UpdateMapDefinition` | Overrides the definition for the specified Map. |
| `mirroredAzureDatabricksCatalog` | Discovery | **GET** | `/workspaces/{workspaceId}/azureDatabricks/catalogs` | `Discovery_DiscoverCatalogs` | Returns a list of catalogs from Unity Catalog. |
| `mirroredAzureDatabricksCatalog` | Discovery | **GET** | `/workspaces/{workspaceId}/azureDatabricks/catalogs/{catalogName}/schemas` | `Discovery_DiscoverSchemas` | Returns a list of schemas in the given catalog from Unity Catalog. |
| `mirroredAzureDatabricksCatalog` | Discovery | **GET** | `/workspaces/{workspaceId}/azureDatabricks/catalogs/{catalogName}/schemas/{schemaName}/tables` | `Discovery_DiscoverTables` | Returns a list of tables in the given schema from Unity Catalog. |
| `mirroredAzureDatabricksCatalog` | Items | **GET** | `/workspaces/{workspaceId}/mirroredAzureDatabricksCatalogs` | `Items_ListMirroredAzureDatabricksCatalogs` | Returns a list of mirroredAzureDatabricksCatalogs from the specified workspace. |
| `mirroredAzureDatabricksCatalog` | Items | **POST** | `/workspaces/{workspaceId}/mirroredAzureDatabricksCatalogs` | `Items_CreateMirroredAzureDatabricksCatalog` | Creates a mirroredAzureDatabricksCatalog in the specified workspace. |
| `mirroredAzureDatabricksCatalog` | Items | **GET** | `/workspaces/{workspaceId}/mirroredAzureDatabricksCatalogs/{mirroredAzureDatabricksCatalogId}` | `Items_GetMirroredAzureDatabricksCatalog` | Returns properties of the specified mirroredAzureDatabricksCatalog. |
| `mirroredAzureDatabricksCatalog` | Items | **PATCH** | `/workspaces/{workspaceId}/mirroredAzureDatabricksCatalogs/{mirroredAzureDatabricksCatalogId}` | `Items_UpdateMirroredAzureDatabricksCatalog` | Updates the properties of the specified mirroredAzureDatabricksCatalog. |
| `mirroredAzureDatabricksCatalog` | Items | **DELETE** | `/workspaces/{workspaceId}/mirroredAzureDatabricksCatalogs/{mirroredAzureDatabricksCatalogId}` | `Items_DeleteMirroredAzureDatabricksCatalog` | Deletes the specified mirroredAzureDatabricksCatalog. |
| `mirroredAzureDatabricksCatalog` | Items | **POST** | `/workspaces/{workspaceId}/mirroredAzureDatabricksCatalogs/{mirroredAzureDatabricksCatalogId}/getDefinition` | `Items_GetMirroredAzureDatabricksCatalogDefinition` | Returns the specified mirroredAzureDatabricksCatalog public definition. |
| `mirroredAzureDatabricksCatalog` | Items | **POST** | `/workspaces/{workspaceId}/mirroredAzureDatabricksCatalogs/{mirroredAzureDatabricksCatalogId}/updateDefinition` | `Items_UpdateMirroredAzureDatabricksCatalogDefinition` | Overrides the definition for the specified mirroredAzureDatabricksCatalog. |
| `mirroredAzureDatabricksCatalog` | Refresh | **POST** | `/workspaces/{workspaceId}/mirroredAzureDatabricksCatalogs/{mirroredAzureDatabricksCatalogId}/refreshCatalogMetadata` | `Refresh_RefreshCatalogMetadata` | Refresh Databricks catalog metadata in mirroredAzureDatabricksCatalogs Item. |
| `mirroredCatalog` | Discovery | **GET** | `/workspaces/{workspaceId}/catalogmirroring/scopes?beta=true` | `Discovery_List_Scopes_(beta)` | Returns a hierarchical list of namespaces from the source catalog. |
| `mirroredCatalog` | Discovery | **GET** | `/workspaces/{workspaceId}/catalogmirroring/tables?beta=true` | `Discovery_List_Tables_(beta)` | Returns a list of tables within a specified namespace scope from the source catalog. |
| `mirroredCatalog` | Items | **GET** | `/workspaces/{workspaceId}/mirroredCatalogs` | `Items_ListMirroredCatalogs` | Returns a list of MirroredCatalogs from the specified workspace. |
| `mirroredCatalog` | Items | **POST** | `/workspaces/{workspaceId}/mirroredCatalogs` | `Items_CreateMirroredCatalog` | Creates a MirroredCatalog in the specified workspace. |
| `mirroredCatalog` | Items | **GET** | `/workspaces/{workspaceId}/mirroredCatalogs/{mirroredCatalogId}` | `Items_GetMirroredCatalog` | Returns properties of the specified MirroredCatalog. |
| `mirroredCatalog` | Items | **PATCH** | `/workspaces/{workspaceId}/mirroredCatalogs/{mirroredCatalogId}` | `Items_UpdateMirroredCatalog` | Updates the properties of the specified MirroredCatalog. |
| `mirroredCatalog` | Items | **DELETE** | `/workspaces/{workspaceId}/mirroredCatalogs/{mirroredCatalogId}` | `Items_DeleteMirroredCatalog` | Deletes the specified MirroredCatalog. |
| `mirroredCatalog` | Items | **POST** | `/workspaces/{workspaceId}/mirroredCatalogs/{mirroredCatalogId}/getDefinition` | `Items_GetMirroredCatalogDefinition` | Returns the specified MirroredCatalog public definition. |
| `mirroredCatalog` | Items | **POST** | `/workspaces/{workspaceId}/mirroredCatalogs/{mirroredCatalogId}/updateDefinition` | `Items_UpdateMirroredCatalogDefinition` | Overrides the definition for the specified MirroredCatalog. |
| `mirroredCatalog` | Monitoring | **GET** | `/workspaces/{workspaceId}/mirroredCatalogs/{mirroredCatalogId}/mirroringStatus?beta=true` | `Monitoring_Mirroring_Status_(beta)` | Returns the overall mirroring status of the MirroredCatalog. |
| `mirroredCatalog` | Monitoring | **GET** | `/workspaces/{workspaceId}/mirroredCatalogs/{mirroredCatalogId}/tablesMirroringStatus?beta=true` | `Monitoring_Tables_Mirroring_Status_(beta)` | Returns the per-table mirroring status for the MirroredCatalog. |
| `mirroredCatalog` | Refresh | **POST** | `/workspaces/{workspaceId}/mirroredCatalogs/{mirroredCatalogId}/refreshCatalogMetadata?beta=true` | `Refresh_Refresh_Catalog_Metadata_(beta)` | Triggers a refresh of catalog metadata from the source. |
| `mirroredDatabase` | Items | **GET** | `/workspaces/{workspaceId}/mirroredDatabases` | `Items_ListMirroredDatabases` | Returns a list of mirrored databases from the specified workspace. |
| `mirroredDatabase` | Items | **POST** | `/workspaces/{workspaceId}/mirroredDatabases` | `Items_CreateMirroredDatabase` | Creates a mirrored database in the specified workspace. |
| `mirroredDatabase` | Items | **GET** | `/workspaces/{workspaceId}/mirroredDatabases/{mirroredDatabaseId}` | `Items_GetMirroredDatabase` | Returns properties of the specified mirrored database. |
| `mirroredDatabase` | Items | **PATCH** | `/workspaces/{workspaceId}/mirroredDatabases/{mirroredDatabaseId}` | `Items_UpdateMirroredDatabase` | Updates the properties of the specified mirrored database. |
| `mirroredDatabase` | Items | **DELETE** | `/workspaces/{workspaceId}/mirroredDatabases/{mirroredDatabaseId}` | `Items_DeleteMirroredDatabase` | Deletes the specified mirrored database. |
| `mirroredDatabase` | Items | **POST** | `/workspaces/{workspaceId}/mirroredDatabases/{mirroredDatabaseId}/getDefinition` | `Items_GetMirroredDatabaseDefinition` | Returns the specified mirrored database public definition. |
| `mirroredDatabase` | Items | **POST** | `/workspaces/{workspaceId}/mirroredDatabases/{mirroredDatabaseId}/updateDefinition` | `Items_UpdateMirroredDatabaseDefinition` | Overrides the definition for the specified mirrored database. |
| `mirroredDatabase` | Mirroring | **POST** | `/workspaces/{workspaceId}/mirroredDatabases/{mirroredDatabaseId}/getMirroringStatus` | `Mirroring_GetMirroringStatus` | Get the status of the mirrored database. |
| `mirroredDatabase` | Mirroring | **POST** | `/workspaces/{workspaceId}/mirroredDatabases/{mirroredDatabaseId}/getTablesMirroringStatus` | `Mirroring_GetTablesMirroringStatus` | Get the mirroring status of the tables. |
| `mirroredDatabase` | Mirroring | **POST** | `/workspaces/{workspaceId}/mirroredDatabases/{mirroredDatabaseId}/startMirroring` | `Mirroring_StartMirroring` | Starts the mirroring. |
| `mirroredDatabase` | Mirroring | **POST** | `/workspaces/{workspaceId}/mirroredDatabases/{mirroredDatabaseId}/stopMirroring` | `Mirroring_StopMirroring` | Stops the mirroring. |
| `mirroredWarehouse` | Items | **GET** | `/workspaces/{workspaceId}/mirroredWarehouses` | `Items_ListMirroredWarehouses` | Returns a list of mirrored warehouses from the specified workspace. |
| `mlExperiment` | Items | **GET** | `/workspaces/{workspaceId}/mlExperiments` | `Items_ListMLExperiments` | Returns a list of machine learning experiments from the specified workspace. |
| `mlExperiment` | Items | **POST** | `/workspaces/{workspaceId}/mlExperiments` | `Items_CreateMLExperiment` | Creates a machine learning experiment in the specified workspace. |
| `mlExperiment` | Items | **GET** | `/workspaces/{workspaceId}/mlExperiments/{mlExperimentId}` | `Items_GetMLExperiment` | Returns properties of the specified machine learning experiment. |
| `mlExperiment` | Items | **PATCH** | `/workspaces/{workspaceId}/mlExperiments/{mlExperimentId}` | `Items_UpdateMLExperiment` | Updates the properties of the specified machine learning experiment. |
| `mlExperiment` | Items | **DELETE** | `/workspaces/{workspaceId}/mlExperiments/{mlExperimentId}` | `Items_DeleteMLExperiment` | Deletes the specified machine learning experiment. |
| `mlModel` | Endpoint | **POST** | `/workspaces/{workspaceId}/mlModels/{modelId}/endpoint/score` | `Endpoint_ScoreMLModelEndpoint` | Scores input data using the default version of the endpoint and returns results. |
| `mlModel` | Endpoint | **GET** | `/workspaces/{workspaceId}/mlmodels/{modelId}/endpoint` | `Endpoint_GetMLModelEndpoint` | Returns properties of the specified machine learning model's endpoint. |
| `mlModel` | Endpoint | **PATCH** | `/workspaces/{workspaceId}/mlmodels/{modelId}/endpoint` | `Endpoint_UpdateMLModelEndpoint` | Updates the default version of the specified model. |
| `mlModel` | Endpoint | **GET** | `/workspaces/{workspaceId}/mlmodels/{modelId}/endpoint/versions` | `Endpoint_ListMLModelEndpointVersions` | Returns a list of all machine learning model endpoint versions. |
| `mlModel` | Endpoint | **POST** | `/workspaces/{workspaceId}/mlmodels/{modelId}/endpoint/versions/deactivateAll` | `Endpoint_DeactivateAllMLModelEndpointVersions` | Deactivates the specified machine learning model and its version's endpoints. |
| `mlModel` | Endpoint | **GET** | `/workspaces/{workspaceId}/mlmodels/{modelId}/endpoint/versions/{name}` | `Endpoint_GetMLModelEndpointVersion` | Returns information about the specified MLModel endpoint version. |
| `mlModel` | Endpoint | **PATCH** | `/workspaces/{workspaceId}/mlmodels/{modelId}/endpoint/versions/{name}` | `Endpoint_UpdateMLModelEndpointVersion` | Update machine learning model endpoint version configuration. |
| `mlModel` | Endpoint | **POST** | `/workspaces/{workspaceId}/mlmodels/{modelId}/endpoint/versions/{name}/activate` | `Endpoint_ActivateMLModelEndpointVersion` | Activates the specified model version endpoint. |
| `mlModel` | Endpoint | **POST** | `/workspaces/{workspaceId}/mlmodels/{modelId}/endpoint/versions/{name}/deactivate` | `Endpoint_DeactivateMLModelEndpointVersion` | Deactivates the specified model version version. |
| `mlModel` | Endpoint | **POST** | `/workspaces/{workspaceId}/mlmodels/{modelId}/endpoint/versions/{name}/score` | `Endpoint_ScoreMLModelEndpointVersion` | Scores input data for the specific version of the endpoint and returns results. |
| `mlModel` | Items | **GET** | `/workspaces/{workspaceId}/mlModels` | `Items_ListMLModels` | Returns a list of machine learning models from the specified workspace. |
| `mlModel` | Items | **POST** | `/workspaces/{workspaceId}/mlModels` | `Items_CreateMLModel` | Creates a machine learning model in the specified workspace. |
| `mlModel` | Items | **GET** | `/workspaces/{workspaceId}/mlModels/{mlModelId}` | `Items_GetMLModel` | Returns properties of the specified machine learning model. |
| `mlModel` | Items | **PATCH** | `/workspaces/{workspaceId}/mlModels/{mlModelId}` | `Items_UpdateMLModel` | Updates the properties of the specified machine learning model. |
| `mlModel` | Items | **DELETE** | `/workspaces/{workspaceId}/mlModels/{mlModelId}` | `Items_DeleteMLModel` | Deletes the specified machine learning model. |
| `mountedDataFactory` | Items | **GET** | `/workspaces/{workspaceId}/mountedDataFactories` | `Items_ListMountedDataFactories` | Returns a list of mounted data factorys from the specified workspace. |
| `mountedDataFactory` | Items | **POST** | `/workspaces/{workspaceId}/mountedDataFactories` | `Items_CreateMountedDataFactory` | Creates a mounted data factory in the specified workspace. |
| `mountedDataFactory` | Items | **GET** | `/workspaces/{workspaceId}/mountedDataFactories/{mountedDataFactoryId}` | `Items_GetMountedDataFactory` | Returns properties of the specified mounted data factory. |
| `mountedDataFactory` | Items | **PATCH** | `/workspaces/{workspaceId}/mountedDataFactories/{mountedDataFactoryId}` | `Items_UpdateMountedDataFactory` | Updates the properties of the specified mounted data factory. |
| `mountedDataFactory` | Items | **DELETE** | `/workspaces/{workspaceId}/mountedDataFactories/{mountedDataFactoryId}` | `Items_DeleteMountedDataFactory` | Deletes the specified mounted data factory. |
| `mountedDataFactory` | Items | **POST** | `/workspaces/{workspaceId}/mountedDataFactories/{mountedDataFactoryId}/getDefinition` | `Items_GetMountedDataFactoryDefinition` | Returns the specified mounted data factory public definition. |
| `mountedDataFactory` | Items | **POST** | `/workspaces/{workspaceId}/mountedDataFactories/{mountedDataFactoryId}/updateDefinition` | `Items_UpdateMountedDataFactoryDefinition` | Overrides the definition for the specified mounted data factory. |
| `notebook` | BackgroundJobs | **GET** | `/workspaces/{workspaceId}/notebooks/{notebookId}/jobs/execute/instances/{jobInstanceId}?beta=true` | `BackgroundJobs_Get_Notebook_Job_Instance_(beta)` | Get one notebook's job instance. |
| `notebook` | BackgroundJobs | **POST** | `/workspaces/{workspaceId}/notebooks/{notebookId}/jobs/execute/instances?beta=false` | `BackgroundJobs_RunOnDemandNotebook` | Run on-demand notebook job instance. |
| `notebook` | Items | **GET** | `/workspaces/{workspaceId}/notebooks` | `Items_ListNotebooks` | Returns a list of notebooks from the specified workspace. |
| `notebook` | Items | **POST** | `/workspaces/{workspaceId}/notebooks` | `Items_CreateNotebook` | Creates a notebook in the specified workspace. |
| `notebook` | Items | **GET** | `/workspaces/{workspaceId}/notebooks/{notebookId}` | `Items_GetNotebook` | Returns properties of the specified notebook. |
| `notebook` | Items | **PATCH** | `/workspaces/{workspaceId}/notebooks/{notebookId}` | `Items_UpdateNotebook` | Updates the properties of the specified notebook. |
| `notebook` | Items | **DELETE** | `/workspaces/{workspaceId}/notebooks/{notebookId}` | `Items_DeleteNotebook` | Deletes the specified notebook. |
| `notebook` | Items | **POST** | `/workspaces/{workspaceId}/notebooks/{notebookId}/getDefinition` | `Items_GetNotebookDefinition` | Returns the specified notebook public definition. |
| `notebook` | Items | **POST** | `/workspaces/{workspaceId}/notebooks/{notebookId}/updateDefinition` | `Items_UpdateNotebookDefinition` | Overrides the definition for the specified notebook. |
| `notebook` | LivySessions | **GET** | `/workspaces/{workspaceId}/notebooks/{notebookId}/livySessions` | `LivySessions_ListLivySessions` | Returns a list of livy sessions from the specified item identifier. |
| `notebook` | LivySessions | **GET** | `/workspaces/{workspaceId}/notebooks/{notebookId}/livySessions/{livyId}` | `LivySessions_GetLivySession` | Returns properties of the specified livy session. |
| `notebook` | LivySessions | **GET** | `/workspaces/{workspaceId}/notebooks/{notebookId}/livySessions?beta=true` | `LivySessions_List_Livy_Sessions_(beta)` | Returns a list of livy sessions from the specified item identifier (beta). |
| `ontology` | Items | **GET** | `/workspaces/{workspaceId}/ontologies` | `Items_ListOntologies` | Returns a list of Ontologies from the specified workspace. |
| `ontology` | Items | **POST** | `/workspaces/{workspaceId}/ontologies` | `Items_CreateOntology` | Creates an Ontology in the specified workspace. |
| `ontology` | Items | **GET** | `/workspaces/{workspaceId}/ontologies/{ontologyId}` | `Items_GetOntology` | Returns properties of the specified Ontology. |
| `ontology` | Items | **PATCH** | `/workspaces/{workspaceId}/ontologies/{ontologyId}` | `Items_UpdateOntology` | Updates the properties of the specified Ontology. |
| `ontology` | Items | **DELETE** | `/workspaces/{workspaceId}/ontologies/{ontologyId}` | `Items_DeleteOntology` | Deletes the specified Ontology. |
| `ontology` | Items | **POST** | `/workspaces/{workspaceId}/ontologies/{ontologyId}/getDefinition` | `Items_GetOntologyDefinition` | Returns the specified Ontology public definition. |
| `ontology` | Items | **POST** | `/workspaces/{workspaceId}/ontologies/{ontologyId}/updateDefinition` | `Items_UpdateOntologyDefinition` | Updates the definition of a specified Ontology. The update overrides the current definition. |
| `operationsAgent` | Items | **GET** | `/workspaces/{workspaceId}/operationsAgents` | `Items_ListOperationsAgents` | Returns a list of OperationsAgents from the specified workspace. |
| `operationsAgent` | Items | **POST** | `/workspaces/{workspaceId}/operationsAgents` | `Items_CreateOperationsAgent` | Creates an OperationsAgent in the specified workspace. |
| `operationsAgent` | Items | **GET** | `/workspaces/{workspaceId}/operationsAgents/{operationsAgentId}` | `Items_GetOperationsAgent` | Returns properties of the specified OperationsAgent. |
| `operationsAgent` | Items | **PATCH** | `/workspaces/{workspaceId}/operationsAgents/{operationsAgentId}` | `Items_UpdateOperationsAgent` | Updates the properties of the specified OperationsAgent. |
| `operationsAgent` | Items | **DELETE** | `/workspaces/{workspaceId}/operationsAgents/{operationsAgentId}` | `Items_DeleteOperationsAgent` | Deletes the specified OperationsAgent. |
| `operationsAgent` | Items | **POST** | `/workspaces/{workspaceId}/operationsAgents/{operationsAgentId}/getDefinition` | `Items_GetOperationsAgentDefinition` | Returns the specified OperationsAgent public definition. |
| `operationsAgent` | Items | **POST** | `/workspaces/{workspaceId}/operationsAgents/{operationsAgentId}/updateDefinition` | `Items_UpdateOperationsAgentDefinition` | Overrides the definition for the specified OperationsAgent. |
| `orgApp` | Items | **GET** | `/workspaces/{workspaceId}/orgApps` | `Items_ListOrgApps` | Returns a list of OrgApps from the specified workspace. |
| `orgApp` | Items | **POST** | `/workspaces/{workspaceId}/orgApps` | `Items_CreateOrgApp` | Creates an OrgApp in the specified workspace. |
| `orgApp` | Items | **GET** | `/workspaces/{workspaceId}/orgApps/{orgAppId}` | `Items_GetOrgApp` | Returns properties of the specified OrgApp. |
| `orgApp` | Items | **PATCH** | `/workspaces/{workspaceId}/orgApps/{orgAppId}` | `Items_UpdateOrgApp` | Updates the properties of the specified OrgApp. |
| `orgApp` | Items | **DELETE** | `/workspaces/{workspaceId}/orgApps/{orgAppId}` | `Items_DeleteOrgApp` | Deletes the specified OrgApp. |
| `orgApp` | Items | **POST** | `/workspaces/{workspaceId}/orgApps/{orgAppId}/getDefinition` | `Items_GetOrgAppDefinition` | Returns the specified OrgApp public definition. |
| `orgApp` | Items | **POST** | `/workspaces/{workspaceId}/orgApps/{orgAppId}/updateDefinition` | `Items_UpdateOrgAppDefinition` | Overrides the definition for the specified OrgApp. |
| `orgAppAudience` | Items | **GET** | `/workspaces/{workspaceId}/orgAppAudiences` | `Items_ListOrgAppAudiences` | Returns a list of OrgAppAudiences from the specified workspace. |
| `orgAppAudience` | Items | **POST** | `/workspaces/{workspaceId}/orgAppAudiences` | `Items_CreateOrgAppAudience` | Creates an OrgAppAudience in the specified workspace. |
| `orgAppAudience` | Items | **GET** | `/workspaces/{workspaceId}/orgAppAudiences/{orgAppAudienceId}` | `Items_GetOrgAppAudience` | Returns properties of the specified OrgAppAudience. |
| `orgAppAudience` | Items | **PATCH** | `/workspaces/{workspaceId}/orgAppAudiences/{orgAppAudienceId}` | `Items_UpdateOrgAppAudience` | Updates the properties of the specified OrgAppAudience. |
| `orgAppAudience` | Items | **DELETE** | `/workspaces/{workspaceId}/orgAppAudiences/{orgAppAudienceId}` | `Items_DeleteOrgAppAudience` | Deletes the specified OrgAppAudience. |
| `orgAppAudience` | Items | **POST** | `/workspaces/{workspaceId}/orgAppAudiences/{orgAppAudienceId}/getDefinition` | `Items_GetOrgAppAudienceDefinition` | Returns the specified OrgAppAudience public definition. |
| `orgAppAudience` | Items | **POST** | `/workspaces/{workspaceId}/orgAppAudiences/{orgAppAudienceId}/updateDefinition` | `Items_UpdateOrgAppAudienceDefinition` | Overrides the definition for the specified OrgAppAudience. |
| `paginatedReport` | Items | **GET** | `/workspaces/{workspaceId}/paginatedReports` | `Items_ListPaginatedReports` | Returns a list of paginated reports from the specified workspace. |
| `paginatedReport` | Items | **POST** | `/workspaces/{workspaceId}/paginatedReports` | `Items_CreatePaginatedReport` | Creates a paginated report in the specified workspace. |
| `paginatedReport` | Items | **GET** | `/workspaces/{workspaceId}/paginatedReports/{paginatedReportId}` | `Items_GetPaginatedReport` | Returns properties of the specified paginated report. |
| `paginatedReport` | Items | **PATCH** | `/workspaces/{workspaceId}/paginatedReports/{paginatedReportId}` | `Items_UpdatePaginatedReport` | Updates the properties of the specified paginated report. |
| `paginatedReport` | Items | **DELETE** | `/workspaces/{workspaceId}/paginatedReports/{paginatedReportId}` | `Items_DeletePaginatedReport` | Deletes the specified paginated report. |
| `paginatedReport` | Items | **POST** | `/workspaces/{workspaceId}/paginatedReports/{paginatedReportId}/getDefinition` | `Items_GetPaginatedReportDefinition` | Returns the specified paginated report public definition. |
| `paginatedReport` | Items | **POST** | `/workspaces/{workspaceId}/paginatedReports/{paginatedReportId}/updateDefinition` | `Items_UpdatePaginatedReportDefinition` | Overrides the definition for the specified paginated report. |
| `plan` | Items | **GET** | `/workspaces/{workspaceId}/plans` | `Items_ListPlans` | Returns a list of plans from the specified workspace. |
| `plan` | Items | **POST** | `/workspaces/{workspaceId}/plans` | `Items_CreatePlan` | Creates a plan in the specified workspace. |
| `plan` | Items | **GET** | `/workspaces/{workspaceId}/plans/{planId}` | `Items_GetPlan` | Returns the properties of the specified plan. |
| `plan` | Items | **PATCH** | `/workspaces/{workspaceId}/plans/{planId}` | `Items_UpdatePlan` | Updates the properties of the specified plan. |
| `plan` | Items | **DELETE** | `/workspaces/{workspaceId}/plans/{planId}` | `Items_DeletePlan` | Deletes the specified plan. |
| `plan` | Items | **POST** | `/workspaces/{workspaceId}/plans/{planId}/getDefinition` | `Items_GetPlanDefinition` | Returns the definition of the specified plan. |
| `plan` | Items | **POST** | `/workspaces/{workspaceId}/plans/{planId}/updateDefinition` | `Items_UpdatePlanDefinition` | Updates the definition of the specified plan. |
| `platform` | Capacities | **GET** | `/capacities` | `Capacities_ListCapacities` | Returns a list of capacities the principal can access (either administrator or a contributor). |
| `platform` | Capacities | **GET** | `/capacities/{capacityId}` | `Capacities_GetCapacity` | Returns specified capacity information. |
| `platform` | Catalog | **POST** | `/catalog/search` | `Catalog_Search` | The Catalog Search API enables programmatic discovery of OneLake catalog entries across workspaces.  |
| `platform` | Connections | **GET** | `/connections` | `Connections_ListConnections` | Returns a list of on-premises, virtual network and cloud connections the user has permission for. |
| `platform` | Connections | **POST** | `/connections` | `Connections_CreateConnection` | Creates a connection. |
| `platform` | Connections | **GET** | `/connections/supportedConnectionTypes` | `Connections_ListSupportedConnectionTypes` | Lists supported connection types. |
| `platform` | Connections | **GET** | `/connections/{connectionId}` | `Connections_GetConnection` | Get connection by ID. |
| `platform` | Connections | **PATCH** | `/connections/{connectionId}` | `Connections_UpdateConnection` | Updates connection by ID. |
| `platform` | Connections | **DELETE** | `/connections/{connectionId}` | `Connections_DeleteConnection` | Delete connection by ID. |
| `platform` | Connections | **GET** | `/connections/{connectionId}/roleAssignments` | `Connections_ListConnectionRoleAssignments` | Returns a list of connection role assignments. |
| `platform` | Connections | **POST** | `/connections/{connectionId}/roleAssignments` | `Connections_AddConnectionRoleAssignment` | Adds a connection role assignment. |
| `platform` | Connections | **GET** | `/connections/{connectionId}/roleAssignments/{connectionRoleAssignmentId}` | `Connections_GetConnectionRoleAssignment` | Returns the principal's role assignment for the connection. |
| `platform` | Connections | **PATCH** | `/connections/{connectionId}/roleAssignments/{connectionRoleAssignmentId}` | `Connections_UpdateConnectionRoleAssignment` | Updates the principal's role assignment for the connection. |
| `platform` | Connections | **DELETE** | `/connections/{connectionId}/roleAssignments/{connectionRoleAssignmentId}` | `Connections_DeleteConnectionRoleAssignment` | Delete the specified role assignment for the connection. |
| `platform` | Connections | **POST** | `/connections/{connectionId}/testConnection` | `Connections_TestConnection` | Tests the connection. |
| `platform` | DeploymentPipelines | **GET** | `/deploymentPipelines` | `DeploymentPipelines_ListDeploymentPipelines` | Returns a list of deployment pipelines the user can access. |
| `platform` | DeploymentPipelines | **POST** | `/deploymentPipelines` | `DeploymentPipelines_CreateDeploymentPipeline` | Creates a new deployment pipeline. |
| `platform` | DeploymentPipelines | **GET** | `/deploymentPipelines/{deploymentPipelineId}` | `DeploymentPipelines_GetDeploymentPipeline` | Returns the specified deployment pipeline metadata. |
| `platform` | DeploymentPipelines | **PATCH** | `/deploymentPipelines/{deploymentPipelineId}` | `DeploymentPipelines_UpdateDeploymentPipeline` | Updates the properties of the specified deployment pipeline. |
| `platform` | DeploymentPipelines | **DELETE** | `/deploymentPipelines/{deploymentPipelineId}` | `DeploymentPipelines_DeleteDeploymentPipeline` | Deletes the specified deployment pipeline. |
| `platform` | DeploymentPipelines | **POST** | `/deploymentPipelines/{deploymentPipelineId}/deploy` | `DeploymentPipelines_DeployStageContent` | Deploys items from the specified stage of the specified deployment pipeline. |
| `platform` | DeploymentPipelines | **GET** | `/deploymentPipelines/{deploymentPipelineId}/operations` | `DeploymentPipelines_ListDeploymentPipelineOperations` | Returns a list of the up-to-20 most recent deploy operations performed on the specified deployment p |
| `platform` | DeploymentPipelines | **GET** | `/deploymentPipelines/{deploymentPipelineId}/operations/{operationId}` | `DeploymentPipelines_GetDeploymentPipelineOperation` | Returns the details of the specified deploy operation performed on the specified deployment pipeline |
| `platform` | DeploymentPipelines | **GET** | `/deploymentPipelines/{deploymentPipelineId}/roleAssignments` | `DeploymentPipelines_ListDeploymentPipelineRoleAssignments` | Returns a list of deployment pipeline role assignments. |
| `platform` | DeploymentPipelines | **POST** | `/deploymentPipelines/{deploymentPipelineId}/roleAssignments` | `DeploymentPipelines_AddDeploymentPipelineRoleAssignment` | Adds a deployment pipeline role assignment. |
| `platform` | DeploymentPipelines | **DELETE** | `/deploymentPipelines/{deploymentPipelineId}/roleAssignments/{principalId}` | `DeploymentPipelines_DeleteDeploymentPipelineRoleAssignment` | Deletes the specified deployment pipeline role assignment. |
| `platform` | DeploymentPipelines | **GET** | `/deploymentPipelines/{deploymentPipelineId}/stages` | `DeploymentPipelines_ListDeploymentPipelineStages` | Returns the specified deployment pipeline stages. |
| `platform` | DeploymentPipelines | **GET** | `/deploymentPipelines/{deploymentPipelineId}/stages/{stageId}` | `DeploymentPipelines_GetDeploymentPipelineStage` | Returns the specified deployment pipeline stage metadata. |
| `platform` | DeploymentPipelines | **PATCH** | `/deploymentPipelines/{deploymentPipelineId}/stages/{stageId}` | `DeploymentPipelines_UpdateDeploymentPipelineStage` | Updates the properties of the specified deployment pipeline stage. |
| `platform` | DeploymentPipelines | **POST** | `/deploymentPipelines/{deploymentPipelineId}/stages/{stageId}/assignWorkspace` | `DeploymentPipelines_AssignWorkspaceToStage` | Assigns the specified workspace to the specified deployment pipeline stage. |
| `platform` | DeploymentPipelines | **GET** | `/deploymentPipelines/{deploymentPipelineId}/stages/{stageId}/items` | `DeploymentPipelines_ListDeploymentPipelineStageItems` | Returns the supported items from the workspace assigned to the specified stage of the specified depl |
| `platform` | DeploymentPipelines | **POST** | `/deploymentPipelines/{deploymentPipelineId}/stages/{stageId}/unassignWorkspace` | `DeploymentPipelines_UnassignWorkspaceFromStage` | Unassigns the workspace from the specified stage in the specified deployment pipeline. |
| `platform` | Domains | **GET** | `/domains` | `Domains_ListDomains` | Returns a list of all the tenant's domains. |
| `platform` | Domains | **GET** | `/domains/{domainId}` | `Domains_GetDomain` | Returns specified domain information. |
| `platform` | ExternalDataSharesProvider | **POST** | `/workspaces/{workspaceId}/items/{itemId}/externalDataShares` | `ExternalDataSharesProvider_CreateExternalDataShare` | Creates an external data share for a given path or list of paths in the specified item. |
| `platform` | ExternalDataSharesProvider | **GET** | `/workspaces/{workspaceId}/items/{itemId}/externalDataShares` | `ExternalDataSharesProvider_ListExternalDataSharesInItem` | Returns a list of the external data shares that exist for the specified item. |
| `platform` | ExternalDataSharesProvider | **GET** | `/workspaces/{workspaceId}/items/{itemId}/externalDataShares/{externalDataShareId}` | `ExternalDataSharesProvider_GetExternalDataShare` | Returns the details of the specified external data share. |
| `platform` | ExternalDataSharesProvider | **DELETE** | `/workspaces/{workspaceId}/items/{itemId}/externalDataShares/{externalDataShareId}` | `ExternalDataSharesProvider_DeleteExternalDataShare` | Deletes the specified external data share. |
| `platform` | ExternalDataSharesProvider | **POST** | `/workspaces/{workspaceId}/items/{itemId}/externalDataShares/{externalDataShareId}/revoke` | `ExternalDataSharesProvider_RevokeExternalDataShare` | Revokes the specified external data share. This action cannot be undone. |
| `platform` | ExternalDataSharesRecipient | **GET** | `/externalDataShares/invitations/{invitationId}` | `ExternalDataSharesRecipient_GetExternalDataShareInvitationDetails` | Returns information about an external data share invitation. |
| `platform` | ExternalDataSharesRecipient | **POST** | `/externalDataShares/invitations/{invitationId}/accept` | `ExternalDataSharesRecipient_AcceptExternalDataShareInvitation` | Accepts an external data share invitation into a specified data item. |
| `platform` | Folders | **GET** | `/workspaces/{workspaceId}/folders` | `Folders_ListFolders` | Returns a list of folders from the specified workspace. |
| `platform` | Folders | **POST** | `/workspaces/{workspaceId}/folders` | `Folders_CreateFolder` | Creates a folder in the specified workspace. |
| `platform` | Folders | **GET** | `/workspaces/{workspaceId}/folders/{folderId}` | `Folders_GetFolder` | Returns the properties of the specified folder. |
| `platform` | Folders | **PATCH** | `/workspaces/{workspaceId}/folders/{folderId}` | `Folders_UpdateFolder` | Updates the properties of the specified folder. |
| `platform` | Folders | **DELETE** | `/workspaces/{workspaceId}/folders/{folderId}` | `Folders_DeleteFolder` | Deletes the specified folder. |
| `platform` | Folders | **POST** | `/workspaces/{workspaceId}/folders/{folderId}/move` | `Folders_MoveFolder` | Moves the specified folder within the same workspace. |
| `platform` | Gateways | **GET** | `/gateways` | `Gateways_ListGateways` | Returns a list of all gateways the user has permission for, including on-premises, on-premises (pers |
| `platform` | Gateways | **POST** | `/gateways` | `Gateways_CreateGateway` | Creates a gateway. |
| `platform` | Gateways | **GET** | `/gateways/{gatewayId}` | `Gateways_GetGateway` | Get gateway by ID. |
| `platform` | Gateways | **PATCH** | `/gateways/{gatewayId}` | `Gateways_UpdateGateway` | Updates gateway by ID. |
| `platform` | Gateways | **DELETE** | `/gateways/{gatewayId}` | `Gateways_DeleteGateway` | Delete gateway by ID. |
| `platform` | Gateways | **POST** | `/gateways/{gatewayId}/checkStatus` | `Gateways_CheckGatewayStatus` | Checks the status of the specified gateway. |
| `platform` | Gateways | **GET** | `/gateways/{gatewayId}/members` | `Gateways_ListGatewayMembers` | Lists gateway members of an OnPremisesGateway by ID. |
| `platform` | Gateways | **PATCH** | `/gateways/{gatewayId}/members/{gatewayMemberId}` | `Gateways_UpdateGatewayMember` | Updates gateway member of an OnPremisesGateway by ID. |
| `platform` | Gateways | **DELETE** | `/gateways/{gatewayId}/members/{gatewayMemberId}` | `Gateways_DeleteGatewayMember` | Delete gateway member of an OnPremisesGateway by ID. |
| `platform` | Gateways | **POST** | `/gateways/{gatewayId}/members/{gatewayMemberId}/checkStatus` | `Gateways_CheckGatewayMemberStatus` | Checks the status of the specified gateway member. |
| `platform` | Gateways | **POST** | `/gateways/{gatewayId}/restart` | `Gateways_RestartGateway` | Restarts the specified gateway. |
| `platform` | Gateways | **GET** | `/gateways/{gatewayId}/roleAssignments` | `Gateways_ListGatewayRoleAssignments` | Returns a list of gateway role assignments. |
| `platform` | Gateways | **POST** | `/gateways/{gatewayId}/roleAssignments` | `Gateways_AddGatewayRoleAssignment` | Adds a gateway role assignment. |
| `platform` | Gateways | **GET** | `/gateways/{gatewayId}/roleAssignments/{gatewayRoleAssignmentId}` | `Gateways_GetGatewayRoleAssignment` | Returns the principal's role assignment for the gateway. |
| `platform` | Gateways | **PATCH** | `/gateways/{gatewayId}/roleAssignments/{gatewayRoleAssignmentId}` | `Gateways_UpdateGatewayRoleAssignment` | Updates the principal's role assignment for the gateway. |
| `platform` | Gateways | **DELETE** | `/gateways/{gatewayId}/roleAssignments/{gatewayRoleAssignmentId}` | `Gateways_DeleteGatewayRoleAssignment` | Delete the specified role assignment for the gateway. |
| `platform` | Gateways | **POST** | `/gateways/{gatewayId}/shutdown` | `Gateways_ShutdownGateway` | Shuts down the specified gateway. |
| `platform` | Git | **POST** | `/workspaces/{workspaceId}/git/commitToGit` | `Git_CommitToGit` | Commits the changes made in the workspace to the connected remote branch. |
| `platform` | Git | **POST** | `/workspaces/{workspaceId}/git/connect` | `Git_Connect` | Connect a specific workspace to a git repository and branch. |
| `platform` | Git | **GET** | `/workspaces/{workspaceId}/git/connection` | `Git_GetConnection` | Returns git connection details for the specified workspace. |
| `platform` | Git | **POST** | `/workspaces/{workspaceId}/git/disconnect` | `Git_Disconnect` | Disconnect a specific workspace from the Git repository and branch it is connected to. |
| `platform` | Git | **POST** | `/workspaces/{workspaceId}/git/initializeConnection` | `Git_InitializeConnection` | Initialize a connection for a workspace that's connected to Git. |
| `platform` | Git | **GET** | `/workspaces/{workspaceId}/git/myGitCredentials` | `Git_GetMyGitCredentials` | Returns the user's Git credentials configuration details. |
| `platform` | Git | **PATCH** | `/workspaces/{workspaceId}/git/myGitCredentials` | `Git_UpdateMyGitCredentials` | Updates the user's Git credentials configuration details. |
| `platform` | Git | **GET** | `/workspaces/{workspaceId}/git/status` | `Git_GetStatus` | Returns the `Git status` of items in the workspace, that can be committed to Git. |
| `platform` | Git | **POST** | `/workspaces/{workspaceId}/git/updateFromGit` | `Git_UpdateFromGit` | Updates the workspace with commits pushed to the connected branch. |
| `platform` | Git | **GET** | `/workspaces/{workspaceId}/git/workspaceRelations` | `Git_ListWorkspaceRelations` | Returns a list of workspace relations for the specified workspace. |
| `platform` | Git | **POST** | `/workspaces/{workspaceId}/git/workspaceRelations` | `Git_CreateWorkspaceRelation` | Creates a workspace relation between the specified workspace and a related workspace. |
| `platform` | Git | **DELETE** | `/workspaces/{workspaceId}/git/workspaceRelations/{workspaceRelationId}` | `Git_DeleteWorkspaceRelation` | Deletes a workspace relation. |
| `platform` | Items | **GET** | `/workspaces/{workspaceId}/items` | `Items_ListItems` | Returns a list of items from the specified workspace. |
| `platform` | Items | **POST** | `/workspaces/{workspaceId}/items` | `Items_CreateItem` | Creates an item in the specified workspace. |
| `platform` | Items | **POST** | `/workspaces/{workspaceId}/items/bulkExportDefinitions?beta=true` | `Items_Bulk_Export_Item_Definitions_(beta)` | Bulk export item definitions from the workspace. |
| `platform` | Items | **POST** | `/workspaces/{workspaceId}/items/bulkImportDefinitions?beta=true` | `Items_Bulk_Import_Item_Definitions_(beta)` | Bulk import item definitions into the workspace. |
| `platform` | Items | **POST** | `/workspaces/{workspaceId}/items/bulkMove` | `Items_BulkMoveItems` | Move multiple items to a folder. Children items are moved with their parent items. You can't move ch |
| `platform` | Items | **GET** | `/workspaces/{workspaceId}/items/{itemId}` | `Items_GetItem` | Returns properties of the specified item. |
| `platform` | Items | **PATCH** | `/workspaces/{workspaceId}/items/{itemId}` | `Items_UpdateItem` | Updates the properties of the specified item. |
| `platform` | Items | **DELETE** | `/workspaces/{workspaceId}/items/{itemId}` | `Items_DeleteItem` | Deletes the specified item. |
| `platform` | Items | **GET** | `/workspaces/{workspaceId}/items/{itemId}/connections` | `Items_ListItemConnections` | Returns the list of connections that the specified item is connected to. |
| `platform` | Items | **POST** | `/workspaces/{workspaceId}/items/{itemId}/getDefinition` | `Items_GetItemDefinition` | Returns the specified item definition. |
| `platform` | Items | **POST** | `/workspaces/{workspaceId}/items/{itemId}/identities/default/assign?beta=true` | `Items_Associate_Identity_(beta)` | Associates the default identity with an item. |
| `platform` | Items | **POST** | `/workspaces/{workspaceId}/items/{itemId}/move` | `Items_MoveItem` | Move the specified item to a folder within the same workspace. Child items are moved with their pare |
| `platform` | Items | **GET** | `/workspaces/{workspaceId}/items/{itemId}/relations/downstream?beta=true` | `Items_Get_Downstream_Relations_(beta)` | Gets downstream relations for an item. |
| `platform` | Items | **GET** | `/workspaces/{workspaceId}/items/{itemId}/relations/upstream?beta=true` | `Items_Get_Upstream_Relations_(beta)` | Gets upstream relations for an item. |
| `platform` | Items | **POST** | `/workspaces/{workspaceId}/items/{itemId}/updateDefinition` | `Items_UpdateItemDefinition` | Overrides the definition for the specified item. |
| `platform` | JobScheduler | **GET** | `/workspaces/{workspaceId}/items/{itemId}/jobs/instances` | `JobScheduler_ListItemJobInstances` | Returns a list of job instances for the specified item. |
| `platform` | JobScheduler | **GET** | `/workspaces/{workspaceId}/items/{itemId}/jobs/instances/{jobInstanceId}` | `JobScheduler_GetItemJobInstance` | Get one item's job instance. |
| `platform` | JobScheduler | **POST** | `/workspaces/{workspaceId}/items/{itemId}/jobs/instances/{jobInstanceId}/cancel` | `JobScheduler_CancelItemJobInstance` | Cancel an item's job instance. |
| `platform` | JobScheduler | **POST** | `/workspaces/{workspaceId}/items/{itemId}/jobs/{jobType}/instances` | `JobScheduler_RunOnDemandItemJob` | Run on-demand item job instance. |
| `platform` | JobScheduler | **GET** | `/workspaces/{workspaceId}/items/{itemId}/jobs/{jobType}/schedules` | `JobScheduler_ListItemSchedules` | Get scheduling settings for one specific item. |
| `platform` | JobScheduler | **POST** | `/workspaces/{workspaceId}/items/{itemId}/jobs/{jobType}/schedules` | `JobScheduler_CreateItemSchedule` | Create a new schedule for an item. An item can create maximum 20 schedulers. |
| `platform` | JobScheduler | **GET** | `/workspaces/{workspaceId}/items/{itemId}/jobs/{jobType}/schedules/{scheduleId}` | `JobScheduler_GetItemSchedule` | Get an existing schedule for an item. |
| `platform` | JobScheduler | **PATCH** | `/workspaces/{workspaceId}/items/{itemId}/jobs/{jobType}/schedules/{scheduleId}` | `JobScheduler_UpdateItemSchedule` | Update an existing schedule for an item. |
| `platform` | JobScheduler | **DELETE** | `/workspaces/{workspaceId}/items/{itemId}/jobs/{jobType}/schedules/{scheduleId}` | `JobScheduler_DeleteItemSchedule` | Delete an existing schedule for an item. |
| `platform` | LongRunningOperations | **GET** | `/operations/{operationId}` | `LongRunningOperations_GetOperationState` | Returns the current state of the long running operation. |
| `platform` | LongRunningOperations | **GET** | `/operations/{operationId}/result` | `LongRunningOperations_GetOperationResult` | Returns the result of the long running operation. |
| `platform` | ManagedPrivateEndpoints | **GET** | `/workspaces/{workspaceId}/managedPrivateEndpoints` | `ManagedPrivateEndpoints_ListWorkspaceManagedPrivateEndpoints` | Returns a list of managed private endpoints associated with the specified workspace. |
| `platform` | ManagedPrivateEndpoints | **POST** | `/workspaces/{workspaceId}/managedPrivateEndpoints` | `ManagedPrivateEndpoints_CreateWorkspaceManagedPrivateEndpoint` | Creates a managed private endpoint in the specified workspace. |
| `platform` | ManagedPrivateEndpoints | **DELETE** | `/workspaces/{workspaceId}/managedPrivateEndpoints/{managedPrivateEndpointId}` | `ManagedPrivateEndpoints_DeleteWorkspaceManagedPrivateEndpoint` | Deletes the specified managed private endpoint. |
| `platform` | ManagedPrivateEndpoints | **GET** | `/workspaces/{workspaceId}/managedPrivateEndpoints/{managedPrivateEndpointId}` | `ManagedPrivateEndpoints_GetWorkspaceManagedPrivateEndpoint` | Gets the specified managed private endpoint. |
| `platform` | OneLakeDataAccessSecurity | **GET** | `/workspaces/{workspaceId}/items/{itemId}/dataAccessRoles` | `OneLakeDataAccessSecurity_ListDataAccessRoles` | Returns a list of OneLake roles. |
| `platform` | OneLakeDataAccessSecurity | **PUT** | `/workspaces/{workspaceId}/items/{itemId}/dataAccessRoles` | `OneLakeDataAccessSecurity_CreateOrUpdateDataAccessRoles` | Creates or updates data access roles in OneLake. |
| `platform` | OneLakeDataAccessSecurity | **POST** | `/workspaces/{workspaceId}/items/{itemId}/dataAccessRoles` | `OneLakeDataAccessSecurity_CreateOrUpdateSingleDataAccessRole` | Creates or updates (upserts) a single data access role. |
| `platform` | OneLakeDataAccessSecurity | **GET** | `/workspaces/{workspaceId}/items/{itemId}/dataAccessRoles/{roleName}` | `OneLakeDataAccessSecurity_GetDataAccessRole` | Returns data access role details for the given role name. |
| `platform` | OneLakeDataAccessSecurity | **DELETE** | `/workspaces/{workspaceId}/items/{itemId}/dataAccessRoles/{roleName}` | `OneLakeDataAccessSecurity_DeleteDataAccessRole` | Deletes a single data access role. |
| `platform` | OneLakeLifecyclePolicy | **POST** | `/workspaces/{workspaceId}/onelake/lifecycle/exportPolicy` | `OneLakeLifecyclePolicy_ExportPolicy` | Exports the OneLake lifecycle management policy for a workspace. |
| `platform` | OneLakeLifecyclePolicy | **POST** | `/workspaces/{workspaceId}/onelake/lifecycle/importPolicy` | `OneLakeLifecyclePolicy_ImportPolicy` | Imports a OneLake lifecycle management policy for a workspace. |
| `platform` | OneLakeSettings | **GET** | `/workspaces/{workspaceId}/onelake/settings` | `OneLakeSettings_GetSettings` | Get workspace OneLake settings. |
| `platform` | OneLakeSettings | **POST** | `/workspaces/{workspaceId}/onelake/settings/modifyDefaultTier` | `OneLakeSettings_ModifyDefaultTier` | Modifies the default OneLake storage tier for a workspace. |
| `platform` | OneLakeSettings | **POST** | `/workspaces/{workspaceId}/onelake/settings/modifyDiagnostics` | `OneLakeSettings_ModifyDiagnostics` | Enables or disables workspace OneLake diagnostic settings. |
| `platform` | OneLakeSettings | **POST** | `/workspaces/{workspaceId}/onelake/settings/modifyImmutabilityPolicy` | `OneLakeSettings_ModifyImmutabilityPolicy` | Create or update OneLake immutability settings. |
| `platform` | OneLakeShortcuts | **GET** | `/workspaces/{workspaceId}/items/{itemId}/shortcuts` | `OneLakeShortcuts_ListShortcuts` | Returns a list of shortcuts for the item, including all the subfolders exhaustively. |
| `platform` | OneLakeShortcuts | **POST** | `/workspaces/{workspaceId}/items/{itemId}/shortcuts` | `OneLakeShortcuts_CreateShortcut` | Creates a new shortcut or updates an existing shortcut. |
| `platform` | OneLakeShortcuts | **POST** | `/workspaces/{workspaceId}/items/{itemId}/shortcuts/bulkCreate` | `OneLakeShortcuts_CreatesShortcutsInBulk` | Creates bulk shortcuts. |
| `platform` | OneLakeShortcuts | **GET** | `/workspaces/{workspaceId}/items/{itemId}/shortcuts/{shortcutPath}/{shortcutName}` | `OneLakeShortcuts_GetShortcut` | Returns shortcut properties. |
| `platform` | OneLakeShortcuts | **DELETE** | `/workspaces/{workspaceId}/items/{itemId}/shortcuts/{shortcutPath}/{shortcutName}` | `OneLakeShortcuts_DeleteShortcut` | Deletes the shortcut but does not delete the destination storage folder. |
| `platform` | OneLakeShortcuts | **POST** | `/workspaces/{workspaceId}/onelake/resetShortcutCache` | `OneLakeShortcuts_ResetShortcutCache` | Deletes any cached files that were stored while reading from shortcuts. |
| `platform` | RecoverableItems | **GET** | `/workspaces/{workspaceId}/recoverableItems` | `RecoverableItems_ListRecoverableItems` | Lists recoverable items in a workspace. |
| `platform` | RecoverableItems | **DELETE** | `/workspaces/{workspaceId}/recoverableItems/{itemId}` | `RecoverableItems_DeleteRecoverableItem` | Permanently deletes a recoverable item. |
| `platform` | RecoverableItems | **POST** | `/workspaces/{workspaceId}/recoverableItems/{itemId}/recover` | `RecoverableItems_RecoverItem` | Recovers a soft-deleted item in the specified workspace. |
| `platform` | Tags | **GET** | `/tags` | `Tags_ListTags` | Returns a list of all the tenant's tags. |
| `platform` | Tags | **POST** | `/workspaces/{workspaceId}/items/{itemId}/applyTags` | `Tags_ApplyTags` | Apply tags on an item. |
| `platform` | Tags | **POST** | `/workspaces/{workspaceId}/items/{itemId}/unapplyTags` | `Tags_UnapplyTags` | Unapply tags from an item. |
| `platform` | Workspaces | **POST** | `/workspaces` | `Workspaces_CreateWorkspace` | Creates a new workspace. |
| `platform` | Workspaces | **GET** | `/workspaces` | `Workspaces_ListWorkspaces` | Returns a list of workspaces the principal can access. Use the roles query parameter to filter resul |
| `platform` | Workspaces | **GET** | `/workspaces/{workspaceId}` | `Workspaces_GetWorkspace` | Returns specified workspace information. |
| `platform` | Workspaces | **PATCH** | `/workspaces/{workspaceId}` | `Workspaces_UpdateWorkspace` | Updates the specified workspace properties. |
| `platform` | Workspaces | **DELETE** | `/workspaces/{workspaceId}` | `Workspaces_DeleteWorkspace` | Deletes the specified workspace and the items under it. |
| `platform` | Workspaces | **POST** | `/workspaces/{workspaceId}/applyTags` | `Workspaces_ApplyWorkspaceTags` | Apply tags to a workspace. |
| `platform` | Workspaces | **POST** | `/workspaces/{workspaceId}/assignToCapacity` | `Workspaces_AssignToCapacity` | Assigns the specified workspace to the specified capacity. |
| `platform` | Workspaces | **POST** | `/workspaces/{workspaceId}/assignToDomain` | `Workspaces_AssignToDomain` | Assigns the specified workspace to the specified domain. |
| `platform` | Workspaces | **POST** | `/workspaces/{workspaceId}/deprovisionIdentity` | `Workspaces_DeprovisionIdentity` | Deprovision a workspace identity. |
| `platform` | Workspaces | **GET** | `/workspaces/{workspaceId}/encryption` | `Workspaces_GetWorkspaceEncryption` | Gets the workspace Customer-Managed Key (CMK) encryption settings. |
| `platform` | Workspaces | **POST** | `/workspaces/{workspaceId}/encryption/assign` | `Workspaces_AssignWorkspaceEncryption` | Assigns a Customer-Managed Key (CMK) to a workspace. |
| `platform` | Workspaces | **POST** | `/workspaces/{workspaceId}/encryption/reset` | `Workspaces_ResetWorkspaceEncryption` | Resets the workspace encryption by removing the Customer-Managed Key (CMK) encryption configuration. |
| `platform` | Workspaces | **GET** | `/workspaces/{workspaceId}/networking/communicationPolicy` | `Workspaces_GetNetworkCommunicationPolicy` | Returns the networking communication policy for the specified workspace. |
| `platform` | Workspaces | **PUT** | `/workspaces/{workspaceId}/networking/communicationPolicy` | `Workspaces_SetNetworkCommunicationPolicy` | Sets the networking communication policy for the specified workspace. |
| `platform` | Workspaces | **GET** | `/workspaces/{workspaceId}/networking/communicationPolicy/inbound/azureResources` | `Workspaces_GetInboundAzureResourceRules` | Returns the inbound Azure resource instance rules for a workspace. This API is designed to help work |
| `platform` | Workspaces | **PUT** | `/workspaces/{workspaceId}/networking/communicationPolicy/inbound/azureResources` | `Workspaces_SetInboundAzureResourceRules` | Sets the inbound Azure resource instance rules for a workspace. This API enables workspace administr |
| `platform` | Workspaces | **GET** | `/workspaces/{workspaceId}/networking/communicationPolicy/inbound/externalDataShares` | `Workspaces_GetInboundExternalDataSharesPolicy` | Returns the inbound External Data Shares bypass policy for a workspace. This API is designed to help |
| `platform` | Workspaces | **PUT** | `/workspaces/{workspaceId}/networking/communicationPolicy/inbound/externalDataShares` | `Workspaces_SetInboundExternalDataSharesPolicy` | Sets the inbound External Data Shares bypass policy for a workspace. This API enables workspace admi |
| `platform` | Workspaces | **GET** | `/workspaces/{workspaceId}/networking/communicationPolicy/inbound/firewall` | `Workspaces_GetFirewallRules` | Returns the IP firewall rules for the workspace. This API is designed to help workspace administrato |
| `platform` | Workspaces | **PUT** | `/workspaces/{workspaceId}/networking/communicationPolicy/inbound/firewall` | `Workspaces_SetFirewallRules` | Sets the IP firewall rules for the workspace. This API enables workspace administrators to set IP fi |
| `platform` | Workspaces | **GET** | `/workspaces/{workspaceId}/networking/communicationPolicy/outbound/connections` | `Workspaces_GetOutboundCloudConnectionRules` | Returns the cloud connection rules for the workspace enabled with Outbound Access Protection (OAP). |
| `platform` | Workspaces | **PUT** | `/workspaces/{workspaceId}/networking/communicationPolicy/outbound/connections` | `Workspaces_SetOutboundCloudConnectionRules` | Sets the outbound access protection cloud connection rules for the workspace. |
| `platform` | Workspaces | **GET** | `/workspaces/{workspaceId}/networking/communicationPolicy/outbound/gateways` | `Workspaces_GetOutboundGatewayRules` | Returns the gateway rules for the workspace enabled with Outbound Access Protection (OAP). |
| `platform` | Workspaces | **PUT** | `/workspaces/{workspaceId}/networking/communicationPolicy/outbound/gateways` | `Workspaces_SetOutboundGatewayRules` | Sets the gateway rules for the workspace enabled with Outbound Access Protection (OAP). |
| `platform` | Workspaces | **GET** | `/workspaces/{workspaceId}/networking/communicationPolicy/outbound/git` | `Workspaces_GetGitOutboundPolicy` | Returns Git Outbound policy for the specified workspace. |
| `platform` | Workspaces | **PUT** | `/workspaces/{workspaceId}/networking/communicationPolicy/outbound/git` | `Workspaces_SetGitOutboundPolicy` | Sets Git Outbound policy for the specified workspace, when Outbound policy is set to 'Deny'. |
| `platform` | Workspaces | **POST** | `/workspaces/{workspaceId}/provisionIdentity` | `Workspaces_ProvisionIdentity` | Provision a workspace identity for a workspace. |
| `platform` | Workspaces | **POST** | `/workspaces/{workspaceId}/roleAssignments` | `Workspaces_AddWorkspaceRoleAssignment` | Adds a workspace role assignment. |
| `platform` | Workspaces | **GET** | `/workspaces/{workspaceId}/roleAssignments` | `Workspaces_ListWorkspaceRoleAssignments` | Returns a list of workspace role assignments. |
| `platform` | Workspaces | **DELETE** | `/workspaces/{workspaceId}/roleAssignments/{workspaceRoleAssignmentId}` | `Workspaces_DeleteWorkspaceRoleAssignment` | Deletes the specified workspace role assignment. |
| `platform` | Workspaces | **PATCH** | `/workspaces/{workspaceId}/roleAssignments/{workspaceRoleAssignmentId}` | `Workspaces_UpdateWorkspaceRoleAssignment` | Updates a workspace role assignment. |
| `platform` | Workspaces | **GET** | `/workspaces/{workspaceId}/roleAssignments/{workspaceRoleAssignmentId}` | `Workspaces_GetWorkspaceRoleAssignment` | Returns information of a workspace role assignment. |
| `platform` | Workspaces | **POST** | `/workspaces/{workspaceId}/unapplyTags` | `Workspaces_UnapplyWorkspaceTags` | Unapply tags from a workspace. |
| `platform` | Workspaces | **POST** | `/workspaces/{workspaceId}/unassignFromCapacity` | `Workspaces_UnassignFromCapacity` | Unassigns the specified workspace from capacity. |
| `platform` | Workspaces | **POST** | `/workspaces/{workspaceId}/unassignFromDomain` | `Workspaces_UnassignFromDomain` | Unassigns the specified workspace from domain. |
| `realTimeIntelligence` | Copilot | **POST** | `/workspaces/{workspaceId}/realTimeIntelligence/nltokql?beta=true` | `Copilot_NL_To_KQL_(beta)` | Returns a KQL query generated from natural language. |
| `reflex` | Items | **GET** | `/workspaces/{workspaceId}/reflexes` | `Items_ListReflexes` | Returns a list of Reflexes from the specified workspace. |
| `reflex` | Items | **POST** | `/workspaces/{workspaceId}/reflexes` | `Items_CreateReflex` | Creates a Reflex in the specified workspace. |
| `reflex` | Items | **GET** | `/workspaces/{workspaceId}/reflexes/{reflexId}` | `Items_GetReflex` | Returns properties of the specified Reflex. |
| `reflex` | Items | **PATCH** | `/workspaces/{workspaceId}/reflexes/{reflexId}` | `Items_UpdateReflex` | Updates the properties of the specified Reflex. |
| `reflex` | Items | **DELETE** | `/workspaces/{workspaceId}/reflexes/{reflexId}` | `Items_DeleteReflex` | Deletes the specified Reflex. |
| `reflex` | Items | **POST** | `/workspaces/{workspaceId}/reflexes/{reflexId}/getDefinition` | `Items_GetReflexDefinition` | Returns the specified Reflex public definition. |
| `reflex` | Items | **POST** | `/workspaces/{workspaceId}/reflexes/{reflexId}/updateDefinition` | `Items_UpdateReflexDefinition` | Overrides the definition for the specified Reflex. |
| `report` | Items | **GET** | `/workspaces/{workspaceId}/reports` | `Items_ListReports` | Returns a list of reports from the specified workspace. |
| `report` | Items | **POST** | `/workspaces/{workspaceId}/reports` | `Items_CreateReport` | Creates a report in the specified workspace. |
| `report` | Items | **GET** | `/workspaces/{workspaceId}/reports/{reportId}` | `Items_GetReport` | Returns properties of the specified report. |
| `report` | Items | **PATCH** | `/workspaces/{workspaceId}/reports/{reportId}` | `Items_UpdateReport` | Updates the properties of the specified report. |
| `report` | Items | **DELETE** | `/workspaces/{workspaceId}/reports/{reportId}` | `Items_DeleteReport` | Deletes the specified report. |
| `report` | Items | **POST** | `/workspaces/{workspaceId}/reports/{reportId}/getDefinition` | `Items_GetReportDefinition` | Returns the specified report public definition. |
| `report` | Items | **POST** | `/workspaces/{workspaceId}/reports/{reportId}/updateDefinition` | `Items_UpdateReportDefinition` | Overrides the definition for the specified report. |
| `semanticModel` | Items | **GET** | `/workspaces/{workspaceId}/semanticModels` | `Items_ListSemanticModels` | Returns a list of semantic models from the specified workspace. |
| `semanticModel` | Items | **POST** | `/workspaces/{workspaceId}/semanticModels` | `Items_CreateSemanticModel` | Creates a semantic model in the specified workspace. |
| `semanticModel` | Items | **GET** | `/workspaces/{workspaceId}/semanticModels/{semanticModelId}` | `Items_GetSemanticModel` | Returns properties of the specified semantic model. |
| `semanticModel` | Items | **PATCH** | `/workspaces/{workspaceId}/semanticModels/{semanticModelId}` | `Items_UpdateSemanticModel` | Updates the properties of the specified semantic model. |
| `semanticModel` | Items | **DELETE** | `/workspaces/{workspaceId}/semanticModels/{semanticModelId}` | `Items_DeleteSemanticModel` | Deletes the specified semantic model. |
| `semanticModel` | Items | **POST** | `/workspaces/{workspaceId}/semanticModels/{semanticModelId}/bindConnection` | `Items_BindSemanticModelConnection` | Binds a semantic model data source reference to a data connection. |
| `semanticModel` | Items | **POST** | `/workspaces/{workspaceId}/semanticModels/{semanticModelId}/getDefinition` | `Items_GetSemanticModelDefinition` | Returns the specified semantic model public definition. |
| `semanticModel` | Items | **POST** | `/workspaces/{workspaceId}/semanticModels/{semanticModelId}/updateDefinition` | `Items_UpdateSemanticModelDefinition` | Overrides the definition for the specified semantic model. |
| `snowflakeDatabase` | Items | **GET** | `/workspaces/{workspaceId}/snowflakeDatabases` | `Items_ListSnowflakeDatabases` | Returns a list of SnowflakeDatabase items from the specified Fabric workspace. |
| `snowflakeDatabase` | Items | **POST** | `/workspaces/{workspaceId}/snowflakeDatabases` | `Items_CreateSnowflakeDatabase` | Creates a Snowflake Database item in the specified Fabric workspace. |
| `snowflakeDatabase` | Items | **GET** | `/workspaces/{workspaceId}/snowflakeDatabases/{snowflakeDatabaseId}` | `Items_GetSnowflakeDatabase` | Returns properties of the specified Snowflake Database item. |
| `snowflakeDatabase` | Items | **DELETE** | `/workspaces/{workspaceId}/snowflakeDatabases/{snowflakeDatabaseId}` | `Items_DeleteSnowflakeDatabase` | Deletes the specified Snowflake Database item. |
| `snowflakeDatabase` | Items | **PATCH** | `/workspaces/{workspaceId}/snowflakeDatabases/{snowflakeDatabaseId}` | `Items_UpdateSnowflakeDatabase` | Update properties of the Snowflake Database item. |
| `snowflakeDatabase` | Items | **POST** | `/workspaces/{workspaceId}/snowflakeDatabases/{snowflakeDatabaseId}/getDefinition` | `Items_GetSnowflakeDatabaseDefinition` | Returns the specified Snowflake Database public definition. |
| `snowflakeDatabase` | Items | **POST** | `/workspaces/{workspaceId}/snowflakeDatabases/{snowflakeDatabaseId}/updateDefinition` | `Items_UpdateSnowflakeDatabaseDefinition` | Overrides the definition for the specified Snowflake Database. |
| `spark` | CapacitySettings | **GET** | `/capacities/{capacityId}/spark/settings?beta=true` | `CapacitySettings_GetSparkSettings_(beta)` | Get capacity spark settings. |
| `spark` | CapacitySettings | **PATCH** | `/capacities/{capacityId}/spark/settings?beta=true` | `CapacitySettings_UpdateSparkSettings_(beta)` | Update capacity spark settings. |
| `spark` | CustomPools | **GET** | `/capacities/{capacityId}/spark/pools/{poolId}?beta=true` | `CustomPools_GetCapacityCustomPool_(beta)` | Get custom pool. |
| `spark` | CustomPools | **DELETE** | `/capacities/{capacityId}/spark/pools/{poolId}?beta=true` | `CustomPools_DeleteCapacityCustomPool_(beta)` | Delete custom pool. |
| `spark` | CustomPools | **PATCH** | `/capacities/{capacityId}/spark/pools/{poolId}?beta=true` | `CustomPools_UpdateCapacityCustomPool_(beta)` | Update custom pool. |
| `spark` | CustomPools | **GET** | `/capacities/{capacityId}/spark/pools?beta=true` | `CustomPools_ListCapacityCustomPools_(beta)` | List custom pools. |
| `spark` | CustomPools | **POST** | `/capacities/{capacityId}/spark/pools?beta=true` | `CustomPools_CreateCapacityCustomPool_(beta)` | Create custom pool. |
| `spark` | CustomPools | **GET** | `/workspaces/{workspaceId}/spark/pools` | `CustomPools_ListWorkspaceCustomPools` | List custom pools. |
| `spark` | CustomPools | **POST** | `/workspaces/{workspaceId}/spark/pools` | `CustomPools_CreateWorkspaceCustomPool` | Create custom pool. |
| `spark` | CustomPools | **GET** | `/workspaces/{workspaceId}/spark/pools/{poolId}` | `CustomPools_GetWorkspaceCustomPool` | Get custom pool. |
| `spark` | CustomPools | **DELETE** | `/workspaces/{workspaceId}/spark/pools/{poolId}` | `CustomPools_DeleteWorkspaceCustomPool` | Delete custom pool. |
| `spark` | CustomPools | **PATCH** | `/workspaces/{workspaceId}/spark/pools/{poolId}` | `CustomPools_UpdateWorkspaceCustomPool` | Update custom pool. |
| `spark` | LivySessions | **GET** | `/workspaces/{workspaceId}/spark/livySessions` | `LivySessions_ListLivySessions` | Returns a list of livy sessions from the specified workspace. |
| `spark` | LivySessions | **GET** | `/workspaces/{workspaceId}/spark/livySessions?beta=true` | `LivySessions_List_Livy_Sessions_(beta)` | Returns a list of livy sessions from the specified workspace (beta). |
| `spark` | WorkspaceSettings | **GET** | `/workspaces/{workspaceId}/spark/settings` | `WorkspaceSettings_GetSparkSettings` | Get workspace spark settings. |
| `spark` | WorkspaceSettings | **PATCH** | `/workspaces/{workspaceId}/spark/settings` | `WorkspaceSettings_UpdateSparkSettings` | Update workspace spark settings. |
| `sparkjobdefinition` | BackgroundJobs | **POST** | `/workspaces/{workspaceId}/sparkJobDefinitions/{sparkJobDefinitionId}/jobs/sparkjob/instances` | `BackgroundJobs_RunOnDemandSparkJobDefinition` | Run on-demand [Spark job definition](/fabric/data-engineering/run-spark-job-definition) job instance |
| `sparkjobdefinition` | Items | **GET** | `/workspaces/{workspaceId}/sparkJobDefinitions` | `Items_ListSparkJobDefinitions` | Returns a list of spark job definitions from the specified workspace. |
| `sparkjobdefinition` | Items | **POST** | `/workspaces/{workspaceId}/sparkJobDefinitions` | `Items_CreateSparkJobDefinition` | Creates a spark job definition in the specified workspace. |
| `sparkjobdefinition` | Items | **GET** | `/workspaces/{workspaceId}/sparkJobDefinitions/{sparkJobDefinitionId}` | `Items_GetSparkJobDefinition` | Returns properties of the specified spark job definition. |
| `sparkjobdefinition` | Items | **PATCH** | `/workspaces/{workspaceId}/sparkJobDefinitions/{sparkJobDefinitionId}` | `Items_UpdateSparkJobDefinition` | Updates the properties of the specified spark job definition. |
| `sparkjobdefinition` | Items | **DELETE** | `/workspaces/{workspaceId}/sparkJobDefinitions/{sparkJobDefinitionId}` | `Items_DeleteSparkJobDefinition` | Deletes the specified spark job definition. |
| `sparkjobdefinition` | Items | **POST** | `/workspaces/{workspaceId}/sparkJobDefinitions/{sparkJobDefinitionId}/getDefinition` | `Items_GetSparkJobDefinitionDefinition` | Returns the specified spark job definition public definition. |
| `sparkjobdefinition` | Items | **POST** | `/workspaces/{workspaceId}/sparkJobDefinitions/{sparkJobDefinitionId}/updateDefinition` | `Items_UpdateSparkJobDefinitionDefinition` | Overrides the definition for the specified spark job definition. |
| `sparkjobdefinition` | LivySessions | **GET** | `/workspaces/{workspaceId}/sparkJobDefinitions/{sparkJobDefinitionId}/livySessions` | `LivySessions_ListLivySessions` | Returns a list of livy sessions from the specified item identifier. |
| `sparkjobdefinition` | LivySessions | **GET** | `/workspaces/{workspaceId}/sparkJobDefinitions/{sparkJobDefinitionId}/livySessions/{livyId}` | `LivySessions_GetLivySession` | Returns properties of the specified livy session. |
| `sparkjobdefinition` | LivySessions | **GET** | `/workspaces/{workspaceId}/sparkJobDefinitions/{sparkJobDefinitionId}/livySessions?beta=true` | `LivySessions_List_Livy_Sessions_(beta)` | Returns a list of livy sessions from the specified item identifier (beta). |
| `sqlDatabase` | Items | **GET** | `/workspaces/{workspaceId}/sqlDatabases` | `Items_ListSQLDatabases` | Returns a list of SQL databases from the specified workspace. |
| `sqlDatabase` | Items | **POST** | `/workspaces/{workspaceId}/sqlDatabases` | `Items_CreateSQLDatabase` | Creates a SQL database in the specified workspace. |
| `sqlDatabase` | Items | **GET** | `/workspaces/{workspaceId}/sqlDatabases/restorableDeletedDatabases` | `Items_ListRestorableDeletedDatabases` | Gets the list of restorable deleted databases in the workspace. |
| `sqlDatabase` | Items | **GET** | `/workspaces/{workspaceId}/sqlDatabases/{sqlDatabaseId}` | `Items_GetSQLDatabase` | Returns properties of the specified SQL database. |
| `sqlDatabase` | Items | **PATCH** | `/workspaces/{workspaceId}/sqlDatabases/{sqlDatabaseId}` | `Items_UpdateSQLDatabase` | Updates the properties of the specified SQL database. |
| `sqlDatabase` | Items | **DELETE** | `/workspaces/{workspaceId}/sqlDatabases/{sqlDatabaseId}` | `Items_DeleteSQLDatabase` | Deletes the specified SQL database. |
| `sqlDatabase` | Items | **POST** | `/workspaces/{workspaceId}/sqlDatabases/{sqlDatabaseId}/getDefinition` | `Items_GetSQLDatabaseDefinition` | Returns the specified SQL database public definition. |
| `sqlDatabase` | Items | **POST** | `/workspaces/{workspaceId}/sqlDatabases/{sqlDatabaseId}/revalidateCMK` | `Items_RevalidateCMK` | Revalidate Customer‑Managed Key (CMK) of the specified SQL database. |
| `sqlDatabase` | Items | **POST** | `/workspaces/{workspaceId}/sqlDatabases/{sqlDatabaseId}/updateDefinition` | `Items_UpdateSQLDatabaseDefinition` | Overrides the definition for the specified SQL database. |
| `sqlDatabase` | Mirroring | **POST** | `/workspaces/{workspaceId}/sqlDatabases/{sqlDatabaseId}/startMirroring` | `Mirroring_StartMirroring` | Starts the mirroring of the specified SQL database.. |
| `sqlDatabase` | Mirroring | **POST** | `/workspaces/{workspaceId}/sqlDatabases/{sqlDatabaseId}/stopMirroring` | `Mirroring_StopMirroring` | Stops the mirroring of the specified SQL database. |
| `sqlDatabase` | SQLAuditSettings | **GET** | `/workspaces/{workspaceId}/sqlDatabases/{sqlDatabaseId}/settings/sqlAudit` | `SQLAuditSettings_GetSQLAuditSettings` | Gets the auditing settings on the specified SQL database. |
| `sqlDatabase` | SQLAuditSettings | **PATCH** | `/workspaces/{workspaceId}/sqlDatabases/{sqlDatabaseId}/settings/sqlAudit` | `SQLAuditSettings_UpdateSQLAuditSettings` | Updates the auditing settings on the specified SQL database. |
| `sqlEndpoint` | Items | **GET** | `/workspaces/{workspaceId}/sqlEndpoints` | `Items_ListSQLEndpoints` | Returns a list of SQL endpoints from the specified workspace. |
| `sqlEndpoint` | Items | **GET** | `/workspaces/{workspaceId}/sqlEndpoints/{sqlEndpointId}/connectionString` | `Items_GetConnectionString` | Returns the SQL connection string of the specified warehouse. |
| `sqlEndpoint` | Items | **POST** | `/workspaces/{workspaceId}/sqlEndpoints/{sqlEndpointId}/refreshMetadata` | `Items_RefreshSqlEndpointMetadata` | Refreshes tables within a SQL analytics endpoint. |
| `sqlEndpoint` | Items | **POST** | `/workspaces/{workspaceId}/sqlEndpoints/{sqlEndpointId}/refreshMetadata` | `Items_RefreshSqlEndpointMetadata` | > [!NOTE] > This Preview API is experimental and may change without notice. It is provided for evalu |
| `sqlEndpoint` | SQLAuditSettings | **PATCH** | `/workspaces/{workspaceId}/sqlEndpoints/{itemId}/settings/sqlAudit` | `SQLAuditSettings_UpdateSQLAuditSettings` | Update settings associated with the SQL endpoint. |
| `sqlEndpoint` | SQLAuditSettings | **GET** | `/workspaces/{workspaceId}/sqlEndpoints/{itemId}/settings/sqlAudit` | `SQLAuditSettings_GetSQLAuditSettings` | Returns the settings associated with the SQL endpoint. |
| `sqlEndpoint` | SQLAuditSettings | **POST** | `/workspaces/{workspaceId}/sqlEndpoints/{itemId}/settings/sqlAudit/setAuditActionsAndGroups` | `SQLAuditSettings_SetAuditActionsAndGroups` | Update the audit actions and groups for this SQL endpoint. |
| `userDataFunction` | Items | **GET** | `/workspaces/{workspaceId}/userDataFunctions` | `Items_ListUserDataFunctions` | Returns a list of UserDataFunctions from the specified workspace. |
| `userDataFunction` | Items | **POST** | `/workspaces/{workspaceId}/userDataFunctions` | `Items_CreateUserDataFunction` | Creates a UserDataFunction in the specified workspace. |
| `userDataFunction` | Items | **GET** | `/workspaces/{workspaceId}/userDataFunctions/{userDataFunctionId}` | `Items_GetUserDataFunction` | Returns properties of the specified UserDataFunction. |
| `userDataFunction` | Items | **PATCH** | `/workspaces/{workspaceId}/userDataFunctions/{userDataFunctionId}` | `Items_UpdateUserDataFunction` | Updates the properties of the specified UserDataFunction. |
| `userDataFunction` | Items | **DELETE** | `/workspaces/{workspaceId}/userDataFunctions/{userDataFunctionId}` | `Items_DeleteUserDataFunction` | Deletes the specified UserDataFunction. |
| `userDataFunction` | Items | **POST** | `/workspaces/{workspaceId}/userDataFunctions/{userDataFunctionId}/getDefinition` | `Items_GetUserDataFunctionDefinition` | Returns the specified UserDataFunction public definition. |
| `userDataFunction` | Items | **POST** | `/workspaces/{workspaceId}/userDataFunctions/{userDataFunctionId}/updateDefinition` | `Items_UpdateUserDataFunctionDefinition` | Overrides the definition for the specified UserDataFunction. |
| `variableLibrary` | Items | **GET** | `/workspaces/{workspaceId}/variableLibraries` | `Items_ListVariableLibraries` | Returns a list of variable libraries from the specified workspace. |
| `variableLibrary` | Items | **POST** | `/workspaces/{workspaceId}/variableLibraries` | `Items_CreateVariableLibrary` | Creates a variable library in the specified workspace. |
| `variableLibrary` | Items | **GET** | `/workspaces/{workspaceId}/variableLibraries/{variableLibraryId}` | `Items_GetVariableLibrary` | Returns properties of the specified variable library. |
| `variableLibrary` | Items | **PATCH** | `/workspaces/{workspaceId}/variableLibraries/{variableLibraryId}` | `Items_UpdateVariableLibrary` | Updates the properties of the specified variable library. |
| `variableLibrary` | Items | **DELETE** | `/workspaces/{workspaceId}/variableLibraries/{variableLibraryId}` | `Items_DeleteVariableLibrary` | Deletes the specified variable library. |
| `variableLibrary` | Items | **POST** | `/workspaces/{workspaceId}/variableLibraries/{variableLibraryId}/getDefinition` | `Items_GetVariableLibraryDefinition` | Returns the specified variable library public definition. |
| `variableLibrary` | Items | **POST** | `/workspaces/{workspaceId}/variableLibraries/{variableLibraryId}/updateDefinition` | `Items_UpdateVariableLibraryDefinition` | Overrides the definition for the specified variable library. |
| `warehouse` | Items | **GET** | `/workspaces/{workspaceId}/warehouses` | `Items_ListWarehouses` | Returns a list of warehouses from the specified workspace. |
| `warehouse` | Items | **POST** | `/workspaces/{workspaceId}/warehouses` | `Items_CreateWarehouse` | Creates a warehouse in the specified workspace. |
| `warehouse` | Items | **GET** | `/workspaces/{workspaceId}/warehouses/{warehouseId}` | `Items_GetWarehouse` | Returns properties of the specified warehouse. |
| `warehouse` | Items | **PATCH** | `/workspaces/{workspaceId}/warehouses/{warehouseId}` | `Items_UpdateWarehouse` | Updates the properties of the specified warehouse. |
| `warehouse` | Items | **DELETE** | `/workspaces/{workspaceId}/warehouses/{warehouseId}` | `Items_DeleteWarehouse` | Deletes the specified warehouse. |
| `warehouse` | Items | **GET** | `/workspaces/{workspaceId}/warehouses/{warehouseId}/connectionString` | `Items_GetConnectionString` | Returns the SQL connection string of the specified warehouse. |
| `warehouse` | RestorePoints | **GET** | `/workspaces/{workspaceId}/warehouses/{warehouseId}/restorePoints` | `RestorePoints_ListRestorePoints` | Returns all restore points for a warehouse. |
| `warehouse` | RestorePoints | **POST** | `/workspaces/{workspaceId}/warehouses/{warehouseId}/restorePoints` | `RestorePoints_CreateRestorePoint` | Creates a restore point for a warehouse at the current timestamp. |
| `warehouse` | RestorePoints | **GET** | `/workspaces/{workspaceId}/warehouses/{warehouseId}/restorePoints/{restorePointId}` | `RestorePoints_GetRestorePoint` | Returns the properties of a restore point specified for a warehouse. |
| `warehouse` | RestorePoints | **DELETE** | `/workspaces/{workspaceId}/warehouses/{warehouseId}/restorePoints/{restorePointId}` | `RestorePoints_DeleteRestorePoint` | Deletes a restore point specified for a warehouse. |
| `warehouse` | RestorePoints | **PATCH** | `/workspaces/{workspaceId}/warehouses/{warehouseId}/restorePoints/{restorePointId}` | `RestorePoints_UpdateRestorePoint` | Updates an existing restore point by renaming the name or description of it. |
| `warehouse` | RestorePoints | **POST** | `/workspaces/{workspaceId}/warehouses/{warehouseId}/restorePoints/{restorePointId}/restore` | `RestorePoints_RestoreToRestorePoint` | Restores a warehouse in-place to the restore point specified. |
| `warehouse` | SQLAuditSettings | **PATCH** | `/workspaces/{workspaceId}/warehouses/{itemId}/settings/sqlAudit` | `SQLAuditSettings_UpdateSQLAuditSettings` | Update settings associated with the warehouse. |
| `warehouse` | SQLAuditSettings | **GET** | `/workspaces/{workspaceId}/warehouses/{itemId}/settings/sqlAudit` | `SQLAuditSettings_GetSQLAuditSettings` | Returns the settings associated with the warehouse. |
| `warehouse` | SQLAuditSettings | **POST** | `/workspaces/{workspaceId}/warehouses/{itemId}/settings/sqlAudit/setAuditActionsAndGroups` | `SQLAuditSettings_SetAuditActionsAndGroups` | Update the audit actions and groups for this warehouse. |
| `warehouse` | SQLPools | **GET** | `/workspaces/{workspaceId}/warehouses/sqlPoolsConfiguration?beta=true` | `SQLPools_Get_Sql_Pools_Configuration_(beta)` | Gets the SQL Pools configuration in the specified workspace (beta). |
| `warehouse` | SQLPools | **PATCH** | `/workspaces/{workspaceId}/warehouses/sqlPoolsConfiguration?beta=true` | `SQLPools_Update_Sql_Pools_Configuration_(beta)` | Updates the SQL Pools configuration in the specified workspace (beta). |
| `warehouseSnapshot` | Items | **GET** | `/workspaces/{workspaceId}/warehouseSnapshots` | `Items_ListWarehouseSnapshots` | Returns a list of Warehouse snapshots from the specified workspace. |
| `warehouseSnapshot` | Items | **POST** | `/workspaces/{workspaceId}/warehouseSnapshots` | `Items_CreateWarehouseSnapshot` | Creates a Warehouse snapshot in the specified workspace. |
| `warehouseSnapshot` | Items | **GET** | `/workspaces/{workspaceId}/warehouseSnapshots/{warehouseSnapshotId}` | `Items_GetWarehouseSnapshot` | Returns properties of the specified Warehouse snapshot. |
| `warehouseSnapshot` | Items | **PATCH** | `/workspaces/{workspaceId}/warehouseSnapshots/{warehouseSnapshotId}` | `Items_UpdateWarehouseSnapshot` | Updates the properties of the specified Warehouse snapshot. |
| `warehouseSnapshot` | Items | **DELETE** | `/workspaces/{workspaceId}/warehouseSnapshots/{warehouseSnapshotId}` | `Items_DeleteWarehouseSnapshot` | Deletes the specified Warehouse snapshot. |
